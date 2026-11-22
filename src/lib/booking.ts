import { and, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import { db, t, type Tx } from "@/db";
import type { Appointment, Center, Role } from "@/db/schema";
import { computeAvailability } from "./availability";
import { fmt, localDate } from "./dates";
import { AppError } from "./errors";
import { fullName } from "./format";
import { adjustPoints, notifyUnlockedRewards, pointsFor } from "./loyalty";
import { notifySafe } from "./notify";

export type Actor = { id: string; role: Role; centerId: string };

export function cancellationDeadline(startAt: Date, center: Pick<Center, "cancellationHours">, treatmentHours?: number | null): Date {
  const hours = treatmentHours ?? center.cancellationHours;
  return new Date(startAt.getTime() - hours * 3600000);
}

const when = (d: Date, tz: string) => fmt(d, tz, "EEEE d MMMM 'alle' HH:mm");

async function adminIds(centerId: string): Promise<string[]> {
  const rows = await db
    .select({ id: t.users.id })
    .from(t.users)
    .where(and(eq(t.users.centerId, centerId), eq(t.users.role, "admin"), eq(t.users.active, true)));
  return rows.map((r) => r.id);
}

async function lockEmployee(tx: Tx, employeeId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${employeeId}))`);
}

async function assertNoOverlap(tx: Tx, center: Center, employeeId: string, start: Date, end: Date, excludeId?: string) {
  const buffer = center.bufferMinutes * 60000;
  const clash = await tx
    .select({ id: t.appointments.id })
    .from(t.appointments)
    .where(
      and(
        eq(t.appointments.employeeId, employeeId),
        inArray(t.appointments.status, ["confirmed", "completed"]),
        lt(t.appointments.startAt, new Date(end.getTime() + buffer)),
        gt(t.appointments.endAt, new Date(start.getTime() - buffer)),
        excludeId ? ne(t.appointments.id, excludeId) : undefined,
      ),
    )
    .limit(1);
  if (clash.length) throw new AppError("L'orario selezionato non è più disponibile: si sovrappone a un altro appuntamento.");
}

function isOverlapViolation(e: unknown): boolean {
  const any = e as { code?: string; cause?: { code?: string } };
  return any?.code === "23P01" || any?.cause?.code === "23P01";
}

export type BookInput = {
  center: Center;
  actor: Actor;
  clientId: string;
  treatmentId: string;
  /** null = nessuna preferenza */
  employeeId: string | null;
  start: Date;
  notes?: string;
  promotionId?: string | null;
  /** Solo staff: consente orari fuori turno (resta vietata la sovrapposizione). */
  force?: boolean;
  priceCents?: number;
};

export async function bookAppointment(input: BookInput): Promise<Appointment> {
  const { center, actor } = input;
  const isStaff = actor.role !== "client";
  if (actor.role === "client" && actor.id !== input.clientId) throw new AppError("Operazione non consentita.");
  if (Number.isNaN(input.start.getTime())) throw new AppError("Data non valida.");

  const [treatment] = await db
    .select()
    .from(t.treatments)
    .where(and(eq(t.treatments.id, input.treatmentId), eq(t.treatments.centerId, center.id)));
  if (!treatment || !treatment.active || treatment.status !== "approved") throw new AppError("Trattamento non disponibile.");
  const [client] = await db
    .select()
    .from(t.users)
    .where(and(eq(t.users.id, input.clientId), eq(t.users.centerId, center.id), eq(t.users.role, "client")));
  if (!client || !client.active) throw new AppError("Cliente non trovato.");

  // Prezzo: quello del trattamento, oppure il prezzo promozionale se la promo è valida e collegata.
  let priceCents = treatment.priceCents;
  let promotionId: string | null = null;
  if (input.promotionId) {
    const today = localDate(new Date(), center.timezone);
    const [promo] = await db
      .select()
      .from(t.promotions)
      .where(and(eq(t.promotions.id, input.promotionId), eq(t.promotions.centerId, center.id), eq(t.promotions.active, true)));
    if (promo && promo.startsOn <= today && promo.endsOn >= today) {
      promotionId = promo.id;
      if (promo.treatmentId === treatment.id && promo.promoPriceCents != null) priceCents = promo.promoPriceCents;
    }
  }
  if (isStaff && input.priceCents != null) priceCents = input.priceCents;

  const end = new Date(input.start.getTime() + treatment.durationMinutes * 60000);
  const date = localDate(input.start, center.timezone);
  const startIso = input.start.toISOString();

  let appt: Appointment;
  try {
    appt = await db.transaction(async (tx) => {
      let employeeId = input.employeeId;
      if (!(isStaff && input.force && employeeId)) {
        const slots = await computeAvailability({ center, treatmentId: treatment.id, employeeId, fromDate: date, days: 1, staff: isStaff, exec: tx });
        const slot = slots[date]?.find((s) => s.start === startIso);
        if (!slot) throw new AppError("L'orario selezionato non è più disponibile. Scegli un altro orario.");
        if (!employeeId) {
          // Nessuna preferenza: assegna l'operatore con meno appuntamenti in quella giornata.
          const loads = await tx
            .select({ id: t.appointments.employeeId, n: sql<number>`count(*)::int` })
            .from(t.appointments)
            .where(
              and(
                inArray(t.appointments.employeeId, slot.employeeIds),
                eq(t.appointments.status, "confirmed"),
                sql`(${t.appointments.startAt} at time zone ${center.timezone})::date = ${date}::date`,
              ),
            )
            .groupBy(t.appointments.employeeId);
          const load = new Map(loads.map((l) => [l.id, l.n]));
          employeeId = [...slot.employeeIds].sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0))[0];
        }
      }
      if (!employeeId) throw new AppError("Seleziona un operatore.");
      const [emp] = await tx
        .select({ id: t.users.id })
        .from(t.users)
        .where(and(eq(t.users.id, employeeId), eq(t.users.centerId, center.id), eq(t.users.role, "employee"), eq(t.users.active, true)));
      if (!emp) throw new AppError("Operatore non disponibile.");

      await lockEmployee(tx, employeeId);
      await assertNoOverlap(tx, center, employeeId, input.start, end);
      const reminderWindow = center.reminderHours * 3600000;
      const [row] = await tx
        .insert(t.appointments)
        .values({
          centerId: center.id,
          clientId: client.id,
          employeeId,
          treatmentId: treatment.id,
          promotionId,
          startAt: input.start,
          endAt: end,
          priceCents,
          notes: input.notes?.slice(0, 1000) ?? "",
          createdBy: actor.id,
          // Se l'appuntamento è già dentro la finestra del promemoria, non inviarne un secondo.
          reminderSentAt: input.start.getTime() - Date.now() < reminderWindow ? new Date() : null,
        })
        .returning();
      return row;
    });
  } catch (e) {
    if (isOverlapViolation(e)) throw new AppError("L'orario selezionato è appena stato prenotato. Scegli un altro orario.");
    throw e;
  }

  const whenText = when(appt.startAt, center.timezone);
  if (client.passwordHash)
    await notifySafe(center.id, [client.id], {
      type: "booking",
      title: "Prenotazione confermata",
      body: `${treatment.name} · ${whenText}. Ti aspettiamo!`,
      url: "/app/appuntamenti",
    });
  const staffTargets = [appt.employeeId, ...(await adminIds(center.id))].filter((id) => id !== actor.id);
  await notifySafe(center.id, staffTargets, {
    type: "booking",
    title: "Nuovo appuntamento",
    body: `${fullName(client)} · ${treatment.name} · ${whenText}`,
    url: "/",
  });
  return appt;
}

async function loadAppt(centerId: string, id: string) {
  const [row] = await db
    .select({ appt: t.appointments, treatment: t.treatments, client: t.users })
    .from(t.appointments)
    .innerJoin(t.treatments, eq(t.treatments.id, t.appointments.treatmentId))
    .innerJoin(t.users, eq(t.users.id, t.appointments.clientId))
    .where(and(eq(t.appointments.id, id), eq(t.appointments.centerId, centerId)));
  if (!row) throw new AppError("Appuntamento non trovato.");
  return row;
}

function assertCanTouch(actor: Actor, appt: Appointment) {
  if (actor.role === "client" && appt.clientId !== actor.id) throw new AppError("Operazione non consentita.");
  if (actor.role === "employee" && appt.employeeId !== actor.id) throw new AppError("Puoi gestire solo i tuoi appuntamenti.");
}

export async function cancelAppointment(center: Center, actor: Actor, appointmentId: string, reason = ""): Promise<void> {
  const { appt, treatment, client } = await loadAppt(center.id, appointmentId);
  assertCanTouch(actor, appt);
  if (actor.role === "employee") throw new AppError("Solo l'amministrazione può annullare un appuntamento.");
  if (appt.status !== "confirmed") throw new AppError("Questo appuntamento non può più essere annullato.");
  if (actor.role === "client") {
    const deadline = cancellationDeadline(appt.startAt, center, treatment.cancellationHours);
    if (Date.now() > deadline.getTime())
      throw new AppError(
        `Il termine per la disdetta online è scaduto il ${fmt(deadline, center.timezone, "d MMMM 'alle' HH:mm")}. Contatta il centro per assistenza.`,
      );
  }
  const updated = await db
    .update(t.appointments)
    .set({ status: "cancelled", cancelledAt: new Date(), cancelledBy: actor.id, notes: reason ? `${appt.notes}\nDisdetta: ${reason}`.trim() : appt.notes })
    .where(and(eq(t.appointments.id, appt.id), eq(t.appointments.status, "confirmed")))
    .returning({ id: t.appointments.id });
  if (!updated.length) throw new AppError("Questo appuntamento non può più essere annullato.");

  const whenText = when(appt.startAt, center.timezone);
  if (actor.role !== "client" && client.passwordHash)
    await notifySafe(center.id, [client.id], {
      type: "cancellation",
      title: "Appuntamento annullato",
      body: `Il tuo appuntamento per ${treatment.name} di ${whenText} è stato annullato dal centro.`,
      url: "/app/appuntamenti",
    });
  const staffTargets = [appt.employeeId, ...(await adminIds(center.id))].filter((id) => id !== actor.id);
  await notifySafe(center.id, staffTargets, {
    type: "cancellation",
    title: "Appuntamento disdetto",
    body: `${fullName(client)} · ${treatment.name} · ${whenText}`,
    url: "/",
  });
}

export type UpdateInput = {
  appointmentId: string;
  treatmentId?: string;
  employeeId?: string;
  start?: Date;
  priceCents?: number;
  notes?: string;
};

/** Modifica o sposta un appuntamento (solo amministratore). */
export async function updateAppointment(center: Center, actor: Actor, input: UpdateInput): Promise<Appointment> {
  if (actor.role !== "admin") throw new AppError("Operazione non consentita.");
  const { appt, client } = await loadAppt(center.id, input.appointmentId);
  if (appt.status === "cancelled") throw new AppError("Non è possibile modificare un appuntamento annullato.");

  const treatmentId = input.treatmentId ?? appt.treatmentId;
  const [treatment] = await db.select().from(t.treatments).where(and(eq(t.treatments.id, treatmentId), eq(t.treatments.centerId, center.id)));
  if (!treatment) throw new AppError("Trattamento non trovato.");
  const employeeId = input.employeeId ?? appt.employeeId;
  const [emp] = await db
    .select({ id: t.users.id })
    .from(t.users)
    .where(and(eq(t.users.id, employeeId), eq(t.users.centerId, center.id), eq(t.users.role, "employee")));
  if (!emp) throw new AppError("Operatore non trovato.");
  const start = input.start ?? appt.startAt;
  if (Number.isNaN(start.getTime())) throw new AppError("Data non valida.");
  const end = new Date(start.getTime() + treatment.durationMinutes * 60000);
  const moved = start.getTime() !== appt.startAt.getTime() || employeeId !== appt.employeeId;

  let row: Appointment;
  try {
    row = await db.transaction(async (tx) => {
      await lockEmployee(tx, employeeId);
      await assertNoOverlap(tx, center, employeeId, start, end, appt.id);
      const [r] = await tx
        .update(t.appointments)
        .set({
          treatmentId,
          employeeId,
          startAt: start,
          endAt: end,
          priceCents: input.priceCents ?? (treatmentId !== appt.treatmentId ? treatment.priceCents : appt.priceCents),
          notes: input.notes ?? appt.notes,
          reminderSentAt: moved ? null : appt.reminderSentAt,
        })
        .where(eq(t.appointments.id, appt.id))
        .returning();
      return r;
    });
  } catch (e) {
    if (isOverlapViolation(e)) throw new AppError("L'orario selezionato si sovrappone a un altro appuntamento.");
    throw e;
  }

  if (moved && row.status === "confirmed") {
    const whenText = when(row.startAt, center.timezone);
    if (client.passwordHash)
      await notifySafe(center.id, [client.id], {
        type: "change",
        title: "Appuntamento modificato",
        body: `Il tuo appuntamento per ${treatment.name} è ora fissato per ${whenText}.`,
        url: "/app/appuntamenti",
      });
    const targets = [...new Set([row.employeeId, appt.employeeId])];
    await notifySafe(center.id, targets, {
      type: "change",
      title: "Appuntamento spostato",
      body: `${fullName(client)} · ${treatment.name} · ${whenText}`,
      url: "/staff/appuntamenti",
    });
  }
  return row;
}

/**
 * Segna l'appuntamento come completato e accredita i punti fedeltà
 * (una sola volta: `pointsAwarded` fa da guardia di idempotenza).
 */
export async function completeAppointment(center: Center, actor: Actor, appointmentId: string): Promise<{ points: number }> {
  if (actor.role === "client") throw new AppError("Operazione non consentita.");
  const { appt, treatment } = await loadAppt(center.id, appointmentId);
  assertCanTouch(actor, appt);
  if (appt.status === "cancelled" || appt.status === "no_show") throw new AppError("Appuntamento annullato: non può essere completato.");

  const outcome = await db.transaction(async (tx) => {
    const [cur] = await tx.select().from(t.appointments).where(eq(t.appointments.id, appt.id)).for("update");
    let points = 0;
    let balance: { before: number; after: number } | null = null;
    if (cur.pointsAwarded == null) {
      points = pointsFor(center, cur.priceCents);
      balance = await adjustPoints(tx, {
        centerId: center.id,
        userId: cur.clientId,
        delta: points,
        type: "earn",
        reason: `Trattamento: ${treatment.name}`,
        appointmentId: cur.id,
        createdBy: actor.id,
      });
    }
    await tx
      .update(t.appointments)
      .set({ status: "completed", pointsAwarded: cur.pointsAwarded ?? points })
      .where(eq(t.appointments.id, cur.id));
    return { points, balance, clientId: cur.clientId };
  });

  if (outcome.balance && outcome.points > 0) {
    await notifySafe(center.id, [outcome.clientId], {
      type: "points",
      title: `Hai guadagnato ${outcome.points} punti`,
      body: `Grazie per aver scelto ${treatment.name}. Il tuo saldo è ora di ${outcome.balance.after} punti.`,
      url: "/app/punti",
    });
    await notifyUnlockedRewards(center.id, outcome.clientId, outcome.balance.before, outcome.balance.after);
  }
  return { points: outcome.points };
}

export async function markNoShow(center: Center, actor: Actor, appointmentId: string) {
  if (actor.role === "client") throw new AppError("Operazione non consentita.");
  const { appt } = await loadAppt(center.id, appointmentId);
  assertCanTouch(actor, appt);
  if (appt.status !== "confirmed") throw new AppError("Stato non modificabile.");
  await db.update(t.appointments).set({ status: "no_show" }).where(eq(t.appointments.id, appt.id));
}
