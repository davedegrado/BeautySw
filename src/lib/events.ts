import { and, eq, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { AppError } from "./errors";

/** Iscrizione a un evento con controllo atomico dei posti disponibili. */
export async function registerToEvent(centerId: string, eventId: string, userId: string) {
  await db.transaction(async (tx) => {
    const [ev] = await tx.select().from(t.events).where(and(eq(t.events.id, eventId), eq(t.events.centerId, centerId))).for("update");
    if (!ev || !ev.published) throw new AppError("Evento non disponibile.");
    if (ev.startsAt.getTime() < Date.now()) throw new AppError("Questo evento si è già svolto.");
    const [{ n }] = await tx
      .select({ n: sql<number>`coalesce(sum(${t.eventRegistrations.seats}), 0)::int` })
      .from(t.eventRegistrations)
      .where(eq(t.eventRegistrations.eventId, eventId));
    if (ev.maxParticipants != null && n >= ev.maxParticipants) throw new AppError("Siamo spiacenti, i posti per questo evento sono esauriti.");
    const ins = await tx.insert(t.eventRegistrations).values({ centerId, eventId, userId }).onConflictDoNothing().returning();
    if (!ins.length) throw new AppError("Risulti già iscritta a questo evento.");
  });
}
