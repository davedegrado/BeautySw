"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { DEFAULT_PERMISSIONS } from "@/db/schema";
import { form, run } from "@/lib/action";
import { AppError, type ActionResult } from "@/lib/errors";
import { notifySafe } from "@/lib/notify";
import { hashPassword, rateLimit, rateLimitReset, verifyPassword } from "@/lib/password";
import { createSession, destroySession, homeFor } from "@/lib/session";

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function loginAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const f = form(fd);
    const email = f.email("email")!;
    const password = String(fd.get("password") ?? "");
    const key = `${await clientIp()}:${email}`;
    if (!rateLimit(key)) throw new AppError("Troppi tentativi di accesso. Riprova tra qualche minuto.");
    const [user] = await db.select().from(t.users).where(sql`lower(${t.users.email}) = ${email}`);
    // Confronto sempre eseguito per non rivelare se l'email esiste.
    const ok = await verifyPassword(password, user?.passwordHash ?? "$2b$11$C6UzMDM.H6dfI/f/IKcEeO5KjJ1bG9iV6t2yEnYHtMIeJt1iNseXe");
    if (!user || !user.passwordHash || !ok) throw new AppError("Email o password non corretti.");
    if (!user.active) throw new AppError("Questo account è stato disattivato. Contatta il centro.");
    rateLimitReset(key);
    await createSession(user);
    redirect(homeFor(user.role));
  });
}

export async function registerAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const f = form(fd);
    if (!rateLimit(`reg:${await clientIp()}`, 10, 60 * 60000)) throw new AppError("Troppe registrazioni da questo dispositivo. Riprova più tardi.");
    const slug = f.str("center");
    const [center] = slug
      ? await db.select().from(t.centers).where(eq(t.centers.slug, slug))
      : await db.select().from(t.centers).orderBy(asc(t.centers.createdAt)).limit(1);
    if (!center) throw new AppError("Centro non trovato.");
    const firstName = f.req("firstName", "Nome", 80);
    const lastName = f.req("lastName", "Cognome", 80);
    const email = f.email("email")!;
    const password = f.password("password");
    if (!f.bool("privacy")) throw new AppError("Per registrarti è necessario accettare l'informativa sulla privacy.");
    const [exists] = await db.select({ id: t.users.id }).from(t.users).where(sql`lower(${t.users.email}) = ${email}`);
    if (exists) throw new AppError("Esiste già un account con questa email. Prova ad accedere.");
    const [user] = await db
      .insert(t.users)
      .values({
        centerId: center.id,
        role: "client",
        email,
        passwordHash: await hashPassword(password),
        firstName,
        lastName,
        phone: f.str("phone", 40),
        birthDate: f.date("birthDate", "Data di nascita", true),
      })
      .returning();
    await notifySafe(center.id, [user.id], {
      type: "welcome",
      title: `Benvenuta in ${center.name}`,
      body: "Il tuo profilo è attivo: prenota il tuo primo trattamento e inizia ad accumulare punti Luxury Rewards.",
      url: "/app/prenota",
    });
    await createSession(user);
    redirect("/app");
  });
}

export async function logoutAction() {
  await destroySession();
  redirect("/accedi");
}

/** Configurazione iniziale: crea il primo centro (o un nuovo centro) con il relativo amministratore. */
export async function setupAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const f = form(fd);
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(t.centers);
    if (n > 0) {
      const key = process.env.SETUP_KEY;
      if (!key || f.str("setupKey") !== key) throw new AppError("Configurazione già completata. Per creare un altro centro è richiesta la chiave SETUP_KEY.");
    }
    const name = f.req("centerName", "Nome del centro", 120);
    const slug =
      name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) || "centro";
    const email = f.email("email")!;
    const password = f.password("password");
    const user = await db.transaction(async (tx) => {
      const [center] = await tx
        .insert(t.centers)
        .values({ name, slug: n > 0 ? `${slug}-${Date.now().toString(36)}` : slug, email, phone: f.str("phone", 40), address: f.str("address", 200) })
        .returning();
      const defaults = ["Viso", "Corpo", "Massaggi", "Estetica", "Rituali Luxury"];
      await tx.insert(t.categories).values(defaults.map((c, i) => ({ centerId: center.id, name: c, sort: i })));
      const [admin] = await tx
        .insert(t.users)
        .values({
          centerId: center.id,
          role: "admin",
          email,
          passwordHash: await hashPassword(password),
          firstName: f.req("firstName", "Nome", 80),
          lastName: f.str("lastName", 80),
          permissions: DEFAULT_PERMISSIONS,
        })
        .returning();
      return admin;
    });
    await createSession(user);
    redirect("/admin");
  });
}
