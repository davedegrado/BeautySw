import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify, SignJWT } from "jose";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import type { Center, Role, User } from "@/db/schema";
import { getAuthSecret } from "./config";
import { AppError } from "./errors";

const COOKIE = "aurea_session";
const MAX_AGE = 60 * 60 * 24 * 30;

export type Session = { user: User; center: Center };

export async function createSession(user: Pick<User, "id" | "sessionVersion">) {
  const token = await new SignJWT({ v: user.sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(await getAuthSecret());
  // "Secure" solo su HTTPS: così l'accesso funziona anche provando l'app da telefono
  // sulla rete locale (http://192.168.x.x:3000), dove un cookie Secure verrebbe scartato.
  const h = await headers();
  const https = (h.get("x-forwarded-proto") ?? "").split(",")[0].trim() === "https";
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: https,
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

/** Sessione corrente, riletta dal database a ogni richiesta (account disattivati o password cambiate invalidano subito l'accesso). */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await getAuthSecret(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    const [row] = await db
      .select({ user: t.users, center: t.centers })
      .from(t.users)
      .innerJoin(t.centers, eq(t.centers.id, t.users.centerId))
      .where(eq(t.users.id, payload.sub));
    if (!row || !row.user.active || row.user.sessionVersion !== payload.v) return null;
    return row;
  } catch {
    return null;
  }
});

export function homeFor(role: Role): string {
  return role === "admin" ? "/admin" : role === "employee" ? "/staff" : "/app";
}

/** Per pagine e layout: reindirizza se l'utente non ha il ruolo richiesto. */
export async function requireRole(...roles: Role[]): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/accedi");
  if (!roles.includes(s.user.role)) redirect(homeFor(s.user.role));
  return s;
}

/** Per le server action: solleva un errore invece di reindirizzare. */
export async function actionSession(...roles: Role[]): Promise<Session> {
  const s = await getSession();
  if (!s) throw new AppError("Sessione scaduta. Effettua nuovamente l'accesso.");
  if (roles.length && !roles.includes(s.user.role)) throw new AppError("Non hai i permessi per questa operazione.");
  return s;
}

export const actorOf = (s: Session) => ({ id: s.user.id, role: s.user.role, centerId: s.center.id });
