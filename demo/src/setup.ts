import { client } from "./db";
import { seedDemoCenter } from "../../src/db/seed-demo";

const migrations = import.meta.glob("../../drizzle/*.sql", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

/** Dopo quanti giorni i dati demo vengono ricreati (le date sono relative al giorno di creazione). */
const MAX_AGE_DAYS = 3;
const VERSION = "1";

async function seededAt(): Promise<Date | null> {
  try {
    const { rows } = await client.query<{ value: string }>("select value from demo_meta where key = 'seeded_at'");
    const [v] = await client.query<{ value: string }>("select value from demo_meta where key = 'version'").then((r) => r.rows);
    if (!rows[0] || v?.value !== VERSION) return null;
    return new Date(rows[0].value);
  } catch {
    return null;
  }
}

/** Ricrea da zero database e dati dimostrativi. */
export async function resetDemo(onStatus?: (msg: string) => void) {
  onStatus?.("Creazione del database…");
  await client.exec("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
  for (const name of Object.keys(migrations).sort()) {
    for (const stmt of migrations[name].split("--> statement-breakpoint")) if (stmt.trim()) await client.exec(stmt);
  }
  onStatus?.("Caricamento del centro dimostrativo…");
  await seedDemoCenter();
  await client.exec(`create table demo_meta (key text primary key, value text not null);
    insert into demo_meta values ('seeded_at', '${new Date().toISOString()}'), ('version', '${VERSION}');`);
}

export async function ensureDemo(onStatus: (msg: string) => void) {
  onStatus("Avvio del database…");
  await client.waitReady;
  const at = await seededAt();
  if (!at || Date.now() - at.getTime() > MAX_AGE_DAYS * 86400000) await resetDemo(onStatus);
}
