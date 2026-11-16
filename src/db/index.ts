import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const g = globalThis as unknown as { __pool?: Pool };

function makePool() {
  const url = process.env.DATABASE_URL;
  if (!url) console.warn("[db] DATABASE_URL non configurata: copia .env.example in .env e imposta la connessione al database.");
  return new Pool({
    connectionString: url,
    max: 10,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });
}

export const pool = g.__pool ?? (g.__pool = makePool());
export const db = drizzle(pool, { schema });
export type DB = typeof db;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export * as t from "./schema";
