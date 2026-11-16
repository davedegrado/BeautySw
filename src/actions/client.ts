"use server";

import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { form, run } from "@/lib/action";
import { computeAvailability, type Slot } from "@/lib/availability";
import { bookAppointment, cancelAppointment, cancellationDeadline } from "@/lib/booking";
import { fmt } from "@/lib/dates";
import type { ActionResult } from "@/lib/errors";
import { redeemReward } from "@/lib/loyalty";
import { registerToEvent } from "@/lib/events";
import { notifySafe } from "@/lib/notify";
import { actionSession, actorOf } from "@/lib/session";

type R = ActionResult | null;

/** Orari liberi per trattamento/operatore. Usata dal cliente e dal calendario dello staff. */
export async function availabilityAction(input: {
  treatmentId: string;
  employeeId: string | null;
  fromDate: string;
  days: number;
  excludeAppointmentId?: string;
}): Promise<Record<string, Slot[]>> {
  const s = await actionSession();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fromDate)) return {};
  return computeAvailability({
    center: s.center,
    treatmentId: input.treatmentId,
    employeeId: input.employeeId || null,
    fromDate: input.fromDate,
    days: Math.min(Math.max(1, input.days), 42),
    excludeAppointmentId: s.user.role === "admin" ? input.excludeAppointmentId : undefined,
    staff: s.user.role !== "client",
  });
}

export async function bookAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await actionSession("client");
    const f = form(fd);
    const appt = await bookAppointment({
      center: s.center,
      actor: actorOf(s),
      clientId: s.user.id,
      treatmentId: f.id("treatmentId", "Trattamento"),
      employeeId: f.optId("employeeId"),
      start: new Date(f.req("start", "Orario")),
      notes: f.str("notes", 500),
      promotionId: f.optId("promotionId"),
    });
    const [tr] = await db.select().from(t.treatments).where(eq(t.treatments.id, appt.treatmentId));
    const [emp] = await db.select({ firstName: t.users.firstName }).from(t.users).where(eq(t.users.id, appt.employeeId));
    const tz = s.center.timezone;
    return {
      message: "Prenotazione confermata.",
      data: {
        when: fmt(appt.startAt, tz, "EEEE d MMMM yyyy 'alle' HH:mm"),
        employee: emp.firstName,
        deadline: fmt(cancellationDeadline(appt.startAt, s.center, tr.cancellationHours), tz, "EEEE d MMMM 'alle' HH:mm"),
      },
    };
  });
}

export async function cancelOwnAppointmentAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await actionSession("client");
    await cancelAppointment(s.center, actorOf(s), form(fd).id("id"));
    return "Appuntamento disdetto.";
  });
}

export async function redeemAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await actionSession("client");
    const red = await redeemReward(s.center.id, s.user.id, form(fd).id("rewardId", "Premio"));
    await notifySafe(s.center.id, [s.user.id], {
      type: "reward",
      title: "Premio riscattato",
      body: `${red.rewardName} · codice ${red.code}. Mostralo in istituto per utilizzarlo.`,
      url: "/app/punti",
    });
    return { message: `Premio riscattato! Il tuo codice è ${red.code}`, data: { code: red.code } };
  });
}

export async function joinEventAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await actionSession("client");
    const eventId = form(fd).id("eventId", "Evento");
    await registerToEvent(s.center.id, eventId, s.user.id);
    const [ev] = await db.select().from(t.events).where(eq(t.events.id, eventId));
    await notifySafe(s.center.id, [s.user.id], {
      type: "event",
      title: "Partecipazione confermata",
      body: `Sei in lista per "${ev.title}" · ${fmt(ev.startsAt, s.center.timezone, "d MMMM 'alle' HH:mm")}.`,
      url: `/app/eventi/${ev.id}`,
    });
    return "Partecipazione confermata. Ti aspettiamo!";
  });
}

export async function leaveEventAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await actionSession("client");
    await db
      .delete(t.eventRegistrations)
      .where(and(eq(t.eventRegistrations.eventId, form(fd).id("eventId")), eq(t.eventRegistrations.userId, s.user.id), eq(t.eventRegistrations.centerId, s.center.id)));
    return "Partecipazione annullata.";
  });
}
