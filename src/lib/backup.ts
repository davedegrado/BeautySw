import { eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";

const TABLES = {
  users: t.users,
  categories: t.categories,
  treatments: t.treatments,
  workShifts: t.workShifts,
  availabilityExceptions: t.availabilityExceptions,
  appointments: t.appointments,
  promotions: t.promotions,
  events: t.events,
  eventRegistrations: t.eventRegistrations,
  rewards: t.rewards,
  redemptions: t.redemptions,
  pointsTransactions: t.pointsTransactions,
  broadcasts: t.broadcasts,
} as const;

/** Esporta tutti i dati di un centro (immagini incluse, in base64). Le password restano cifrate (hash). */
export async function exportCenter(centerId: string) {
  const [center] = await db.select().from(t.centers).where(eq(t.centers.id, centerId));
  const out: Record<string, unknown> = { version: 1, exportedAt: new Date().toISOString(), center };
  for (const [name, table] of Object.entries(TABLES)) out[name] = await db.select().from(table).where(eq(table.centerId, centerId));
  const treatmentIds = (out.treatments as { id: string }[]).map((r) => r.id);
  out.employeeTreatments = treatmentIds.length ? await db.select().from(t.employeeTreatments).where(inArray(t.employeeTreatments.treatmentId, treatmentIds)) : [];
  const imgs = await db.select().from(t.images).where(eq(t.images.centerId, centerId));
  out.images = imgs.map((i) => ({ ...i, data: i.data.toString("base64") }));
  return out;
}

export async function exportAll() {
  const centers = await db.select({ id: t.centers.id }).from(t.centers);
  return Promise.all(centers.map((c) => exportCenter(c.id)));
}
