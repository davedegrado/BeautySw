import bcrypt from "bcryptjs";

export const hashPassword = (plain: string) => bcrypt.hash(plain, 11);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

/** Limitatore di tentativi in memoria (per istanza): protegge il login da attacchi a forza bruta. */
const attempts = new Map<string, { n: number; until: number }>();
export function rateLimit(key: string, max = 8, windowMs = 10 * 60000): boolean {
  const now = Date.now();
  const cur = attempts.get(key);
  if (!cur || cur.until < now) {
    attempts.set(key, { n: 1, until: now + windowMs });
    return true;
  }
  cur.n++;
  return cur.n <= max;
}
export function rateLimitReset(key: string) {
  attempts.delete(key);
}
