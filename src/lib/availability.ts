import { and, eq, gt, inArray, lt, ne } from "drizzle-orm";
import { db, t, type DB, type Tx } from "@/db";
import type { Center } from "@/db/schema";
import { addDays, weekdayOf, zoned } from "./dates";

export type Slot = { start: string; employeeIds: string[] };
type Interval = [number, number];
type Exec = DB | Tx;

function merge(list: Interval[]): Interval[] {
  const sorted = list.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: Interval[] = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
    else out.push([iv[0], iv[1]]);
  }
  return out;
}

function subtract(base: Interval[], cuts: Interval[]): Interval[] {
  let out = base;
  for (const [c0, c1] of cuts) {
    const next: Interval[] = [];
    for (const [a, b] of out) {
      if (c1 <= a || c0 >= b) next.push([a, b]);
      else {
        if (c0 > a) next.push([a, c0]);
        if (c1 < b) next.push([c1, b]);
      }
    }
    out = next;
  }
  return out;
}

type Options = {
  center: Center;
  treatmentId: string;
  /** null = nessuna preferenza */
  employeeId?: string | null;
  fromDate: string;
  days: number;
  excludeAppointmentId?: string;
  now?: Date;
  /** Se true ignora l'anticipo minimo (prenotazioni inserite dallo staff). */
  staff?: boolean;
  exec?: Exec;
};

/**
 * Calcola gli orari prenotabili per un trattamento tenendo conto di:
 * durata, turni di lavoro (le pause sono gli intervalli tra le fasce),
 * ferie/indisponibilità, disponibilità straordinarie, appuntamenti esistenti
 * e tempo di preparazione tra un trattamento e l'altro.
 */
export async function computeAvailability(o: Options): Promise<Record<string, Slot[]>> {
  const x = o.exec ?? db;
  const { center } = o;
  const tz = center.timezone;
  const result: Record<string, Slot[]> = {};
  const dates = Array.from({ length: o.days }, (_, i) => addDays(o.fromDate, i));
  for (const d of dates) result[d] = [];

  const [treatment] = await x
    .select()
    .from(t.treatments)
    .where(and(eq(t.treatments.id, o.treatmentId), eq(t.treatments.centerId, center.id)));
  if (!treatment || !treatment.active || treatment.status !== "approved") return result;

  const employees = await x
    .select({ id: t.users.id })
    .from(t.employeeTreatments)
    .innerJoin(t.users, eq(t.users.id, t.employeeTreatments.employeeId))
    .where(
      and(
        eq(t.employeeTreatments.treatmentId, treatment.id),
        eq(t.users.centerId, center.id),
        eq(t.users.role, "employee"),
        eq(t.users.active, true),
        o.employeeId ? eq(t.users.id, o.employeeId) : undefined,
      ),
    );
  const empIds = employees.map((e) => e.id);
  if (!empIds.length) return result;

  const rangeStart = zoned(dates[0], 0, tz);
  const rangeEnd = zoned(addDays(dates[dates.length - 1], 1), 0, tz);
  const bufferMs = center.bufferMinutes * 60000;

  // Query in sequenza: dentro una transazione la connessione è una sola.
  const shifts = await x.select().from(t.workShifts).where(inArray(t.workShifts.employeeId, empIds));
  const exceptions = await x
    .select()
    .from(t.availabilityExceptions)
    .where(
      and(
        inArray(t.availabilityExceptions.employeeId, empIds),
        lt(t.availabilityExceptions.startAt, rangeEnd),
        gt(t.availabilityExceptions.endAt, rangeStart),
      ),
    );
  const appts = await x
    .select({ id: t.appointments.id, employeeId: t.appointments.employeeId, startAt: t.appointments.startAt, endAt: t.appointments.endAt })
    .from(t.appointments)
    .where(
      and(
        inArray(t.appointments.employeeId, empIds),
        inArray(t.appointments.status, ["confirmed", "completed"]),
        lt(t.appointments.startAt, new Date(rangeEnd.getTime() + bufferMs)),
        gt(t.appointments.endAt, new Date(rangeStart.getTime() - bufferMs)),
        o.excludeAppointmentId ? ne(t.appointments.id, o.excludeAppointmentId) : undefined,
      ),
    );

  const now = (o.now ?? new Date()).getTime();
  const earliest = o.staff ? now - 5 * 60000 : now + center.minAdvanceMinutes * 60000;
  const latest = o.staff ? Infinity : now + center.bookingHorizonDays * 86400000;
  const durMs = treatment.durationMinutes * 60000;
  const stepMs = Math.max(5, center.slotIntervalMinutes) * 60000;

  for (const date of dates) {
    const wd = weekdayOf(date);
    const dayStart = zoned(date, 0, tz).getTime();
    const dayEnd = zoned(addDays(date, 1), 0, tz).getTime();
    const byStart = new Map<number, string[]>();

    for (const empId of empIds) {
      const base: Interval[] = shifts
        .filter((s) => s.employeeId === empId && s.weekday === wd)
        .map((s) => [zoned(date, s.startMinute, tz).getTime(), zoned(date, s.endMinute, tz).getTime()]);
      const mine = exceptions.filter((e) => e.employeeId === empId);
      for (const e of mine)
        if (e.kind === "available") base.push([Math.max(e.startAt.getTime(), dayStart), Math.min(e.endAt.getTime(), dayEnd)]);
      const unavailable: Interval[] = mine.filter((e) => e.kind === "unavailable").map((e) => [e.startAt.getTime(), e.endAt.getTime()]);
      const busy: Interval[] = appts
        .filter((a) => a.employeeId === empId)
        .map((a) => [a.startAt.getTime() - bufferMs, a.endAt.getTime() + bufferMs]);
      const free = subtract(subtract(merge(base), unavailable), busy);

      // Gli orari proposti restano allineati alla griglia del centro (es. ogni 15 minuti).
      for (const [a, b] of free) {
        let s = dayStart + Math.ceil((a - dayStart) / stepMs) * stepMs;
        for (; s + durMs <= b; s += stepMs) {
          if (s < earliest || s > latest) continue;
          const list = byStart.get(s);
          if (list) list.push(empId);
          else byStart.set(s, [empId]);
        }
      }
    }
    result[date] = [...byStart.entries()]
      .sort((p, q) => p[0] - q[0])
      .map(([s, ids]) => ({ start: new Date(s).toISOString(), employeeIds: ids }));
  }
  return result;
}
