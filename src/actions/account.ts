"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { form, run } from "@/lib/action";
import { AppError, type ActionResult } from "@/lib/errors";
import { getVapidPublicKey, notifySafe } from "@/lib/notify";
import { hashPassword, verifyPassword } from "@/lib/password";
import { actionSession, createSession } from "@/lib/session";

type R = ActionResult | null;

export async function updateProfileAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await actionSession();
    const f = form(fd);
    const email = f.email("email")!;
    const [dup] = await db.select({ id: t.users.id }).from(t.users).where(sql`lower(${t.users.email}) = ${email} and ${t.users.id} <> ${s.user.id}`);
    if (dup) throw new AppError("Questa email è già utilizzata da un altro account.");
    await db
      .update(t.users)
      .set({
        firstName: f.req("firstName", "Nome", 80),
        lastName: f.str("lastName", 80),
        email,
        phone: f.str("phone", 40),
        birthDate: f.date("birthDate", "Data di nascita", true),
        ...(s.user.role === "employee" ? { notes: f.str("notes", 1000) } : {}),
      })
      .where(eq(t.users.id, s.user.id));
    return "Profilo aggiornato.";
  });
}

export async function changePasswordAction(_: R, fd: FormData) {
  return run(async () => {
    const s = await actionSession();
    const f = form(fd);
    if (!s.user.passwordHash || !(await verifyPassword(String(fd.get("current") ?? ""), s.user.passwordHash)))
      throw new AppError("La password attuale non è corretta.");
    const next = f.password("password");
    if (next !== String(fd.get("confirm") ?? "")) throw new AppError("Le due password non coincidono.");
    const [u] = await db
      .update(t.users)
      .set({ passwordHash: await hashPassword(next), sessionVersion: s.user.sessionVersion + 1 })
      .where(eq(t.users.id, s.user.id))
      .returning();
    await createSession(u); // le altre sessioni vengono invalidate
    return "Password aggiornata.";
  });
}

export async function vapidKeyAction(): Promise<string> {
  await actionSession();
  return getVapidPublicKey();
}

export async function subscribePushAction(sub: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<ActionResult> {
  return run(async () => {
    const s = await actionSession();
    if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) throw new AppError("Sottoscrizione non valida.");
    await db
      .insert(t.pushSubscriptions)
      .values({ userId: s.user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth })
      .onConflictDoUpdate({ target: t.pushSubscriptions.endpoint, set: { userId: s.user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
    return "Notifiche push attivate su questo dispositivo.";
  });
}

export async function unsubscribePushAction(endpoint: string): Promise<ActionResult> {
  return run(async () => {
    const s = await actionSession();
    await db.delete(t.pushSubscriptions).where(and(eq(t.pushSubscriptions.endpoint, endpoint), eq(t.pushSubscriptions.userId, s.user.id)));
    return "Notifiche push disattivate su questo dispositivo.";
  });
}

export async function testPushAction(): Promise<ActionResult> {
  return run(async () => {
    const s = await actionSession();
    await notifySafe(s.center.id, [s.user.id], { type: "test", title: "Notifica di prova", body: "Le notifiche funzionano correttamente ✨", url: "/" });
    return "Notifica di prova inviata.";
  });
}

export async function markAllReadAction(): Promise<ActionResult> {
  return run(async () => {
    const s = await actionSession();
    await db.update(t.notifications).set({ readAt: new Date() }).where(and(eq(t.notifications.userId, s.user.id), isNull(t.notifications.readAt)));
  });
}
