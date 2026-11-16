import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";

const cache = new Map<string, string>();

/** Legge un valore di configurazione; se manca lo genera e lo salva nel database. */
export async function getOrCreateConfig(key: string, generate: () => string): Promise<string> {
  const hit = cache.get(key);
  if (hit) return hit;
  await db.insert(t.appConfig).values({ key, value: generate() }).onConflictDoNothing();
  const [row] = await db.select().from(t.appConfig).where(eq(t.appConfig.key, key));
  cache.set(key, row.value);
  return row.value;
}

export async function getAuthSecret(): Promise<Uint8Array> {
  const env = process.env.AUTH_SECRET;
  const secret = env && env.length >= 32 ? env : await getOrCreateConfig("auth_secret", () => randomBytes(48).toString("hex"));
  return new TextEncoder().encode(secret);
}
