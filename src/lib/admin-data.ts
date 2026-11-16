import { and, asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import type { Center } from "@/db/schema";
import type { FormData_ } from "@/components/calendar-client";
import { localDate } from "./dates";
import { fullName } from "./format";

/** Dati necessari al form di creazione/modifica appuntamento dell'amministratore. */
export async function appointmentFormData(center: Center): Promise<FormData_ & { employeesFull: { id: string; name: string; color: string }[] }> {
  const [clients, treatments, links, employees] = await Promise.all([
    db.select().from(t.users).where(and(eq(t.users.centerId, center.id), eq(t.users.role, "client"), eq(t.users.active, true))).orderBy(asc(t.users.firstName), asc(t.users.lastName)),
    db.select().from(t.treatments).where(and(eq(t.treatments.centerId, center.id), eq(t.treatments.active, true), eq(t.treatments.status, "approved"))).orderBy(asc(t.treatments.name)),
    db.select().from(t.employeeTreatments),
    db.select().from(t.users).where(and(eq(t.users.centerId, center.id), eq(t.users.role, "employee"), eq(t.users.active, true))).orderBy(asc(t.users.firstName)),
  ]);
  return {
    clients: clients.map((c) => ({ id: c.id, name: fullName(c) })),
    treatments: treatments.map((x) => ({ id: x.id, name: x.name, durationMinutes: x.durationMinutes, priceCents: x.priceCents, employeeIds: links.filter((l) => l.treatmentId === x.id).map((l) => l.employeeId) })),
    employees: employees.map((e) => ({ id: e.id, name: fullName(e) })),
    employeesFull: employees.map((e) => ({ id: e.id, name: e.firstName, color: e.color })),
    tz: center.timezone,
    today: localDate(new Date(), center.timezone),
  };
}
