import { aliasedTable, and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { localDate } from "./dates";

const emp = aliasedTable(t.users, "emp");
const cli = aliasedTable(t.users, "cli");

/** Appuntamenti con trattamento, cliente e operatore. `where` è un filtro aggiuntivo. */
export function appointmentRows(centerId: string, where?: ReturnType<typeof and>, order: "asc" | "desc" = "asc", limit = 500) {
  return db
    .select({
      id: t.appointments.id,
      startAt: t.appointments.startAt,
      endAt: t.appointments.endAt,
      status: t.appointments.status,
      priceCents: t.appointments.priceCents,
      notes: t.appointments.notes,
      pointsAwarded: t.appointments.pointsAwarded,
      clientId: t.appointments.clientId,
      employeeId: t.appointments.employeeId,
      treatmentId: t.appointments.treatmentId,
      treatmentName: t.treatments.name,
      durationMinutes: t.treatments.durationMinutes,
      treatmentCancellationHours: t.treatments.cancellationHours,
      clientFirst: cli.firstName,
      clientLast: cli.lastName,
      clientPhone: cli.phone,
      clientEmail: cli.email,
      clientNotes: cli.notes,
      clientBirth: cli.birthDate,
      employeeFirst: emp.firstName,
      employeeLast: emp.lastName,
      employeeColor: emp.color,
    })
    .from(t.appointments)
    .innerJoin(t.treatments, eq(t.treatments.id, t.appointments.treatmentId))
    .innerJoin(cli, eq(cli.id, t.appointments.clientId))
    .innerJoin(emp, eq(emp.id, t.appointments.employeeId))
    .where(and(eq(t.appointments.centerId, centerId), where))
    .orderBy(order === "asc" ? asc(t.appointments.startAt) : desc(t.appointments.startAt))
    .limit(limit);
}
export type ApptRow = Awaited<ReturnType<typeof appointmentRows>>[number];

export function activePromotions(centerId: string, tz: string) {
  const today = localDate(new Date(), tz);
  return db
    .select()
    .from(t.promotions)
    .where(and(eq(t.promotions.centerId, centerId), eq(t.promotions.active, true), lte(t.promotions.startsOn, today), gte(t.promotions.endsOn, today)))
    .orderBy(asc(t.promotions.endsOn));
}

const seatsTaken = sql<number>`(select coalesce(sum(r.seats), 0)::int from event_registrations r where r.event_id = ${t.events.id})`;

export function eventsWithSeats(centerId: string, opts: { upcomingOnly?: boolean; publishedOnly?: boolean } = {}) {
  return db
    .select({ event: t.events, taken: seatsTaken })
    .from(t.events)
    .where(
      and(
        eq(t.events.centerId, centerId),
        opts.publishedOnly ? eq(t.events.published, true) : undefined,
        opts.upcomingOnly ? gte(t.events.startsAt, new Date(Date.now() - 3 * 3600000)) : undefined,
      ),
    )
    .orderBy(opts.upcomingOnly ? asc(t.events.startsAt) : desc(t.events.startsAt));
}
