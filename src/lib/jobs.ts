import { and, eq, gt, isNull, lte, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { fmt, localDate } from "./dates";
import { adjustPoints, notifyUnlockedRewards } from "./loyalty";
import { notifySafe } from "./notify";

/**
 * Job pianificati (idempotenti): promemoria appuntamenti e auguri di compleanno.
 * Vengono eseguiti dal timer interno del server e/o dall'endpoint /api/cron.
 */
export async function runScheduledJobs(now = new Date()) {
  const stats = { reminders: 0, birthdays: 0 };
  const centers = await db.select().from(t.centers);
  for (const center of centers) {
    // --- Promemoria appuntamenti ---
    const until = new Date(now.getTime() + center.reminderHours * 3600000);
    const due = await db
      .update(t.appointments)
      .set({ reminderSentAt: now })
      .where(
        and(
          eq(t.appointments.centerId, center.id),
          eq(t.appointments.status, "confirmed"),
          isNull(t.appointments.reminderSentAt),
          gt(t.appointments.startAt, now),
          lte(t.appointments.startAt, until),
        ),
      )
      .returning();
    for (const a of due) {
      const [tr] = await db.select({ name: t.treatments.name }).from(t.treatments).where(eq(t.treatments.id, a.treatmentId));
      await notifySafe(center.id, [a.clientId], {
        type: "reminder",
        title: "Promemoria appuntamento",
        body: `Ti aspettiamo ${fmt(a.startAt, center.timezone, "EEEE d MMMM 'alle' HH:mm")} per ${tr?.name ?? "il tuo trattamento"}.`,
        url: "/app/appuntamenti",
      });
      stats.reminders++;
    }

    // --- Compleanni ---
    if (!center.birthdayEnabled) continue;
    const today = localDate(now, center.timezone);
    const year = Number(today.slice(0, 4));
    const celebrated = await db
      .update(t.users)
      .set({ lastBirthdayYear: year })
      .where(
        and(
          eq(t.users.centerId, center.id),
          eq(t.users.role, "client"),
          eq(t.users.active, true),
          sql`to_char(${t.users.birthDate}, 'MM-DD') = ${today.slice(5)}`,
          sql`coalesce(${t.users.lastBirthdayYear}, 0) < ${year}`,
        ),
      )
      .returning();
    for (const u of celebrated) {
      let body = center.birthdayMessage.replaceAll("{nome}", u.firstName);
      if (center.birthdayGift) body += ` Il nostro regalo per te: ${center.birthdayGift}`;
      if (center.birthdayBonusPoints > 0) {
        const bal = await db.transaction((tx) =>
          adjustPoints(tx, { centerId: center.id, userId: u.id, delta: center.birthdayBonusPoints, type: "birthday", reason: "Regalo di compleanno" }),
        );
        body += ` In più ${center.birthdayBonusPoints} punti Luxury Rewards in omaggio.`;
        await notifySafe(center.id, [u.id], { type: "birthday", title: `Buon compleanno, ${u.firstName}! 🎂`, body, url: "/app/punti" });
        await notifyUnlockedRewards(center.id, u.id, bal.before, bal.after);
      } else {
        await notifySafe(center.id, [u.id], { type: "birthday", title: `Buon compleanno, ${u.firstName}! 🎂`, body, url: "/app" });
      }
      stats.birthdays++;
    }
  }
  return stats;
}
