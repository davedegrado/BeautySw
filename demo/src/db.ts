import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { Buffer } from "buffer";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../../src/db/schema";

/** PostgreSQL nel browser (WebAssembly), salvato in IndexedDB: ogni dispositivo ha la sua copia della demo. */
export const client = new PGlite("idb://aurea-demo", {
  extensions: { btree_gist },
  relaxedDurability: true,
  // bytea → Buffer, come con node-postgres.
  parsers: { 17: (v: string) => Buffer.from(v.startsWith("\\x") ? v.slice(2) : v, "hex") },
});

export const db = drizzle(client, { schema });
export const pool = { end: async () => {} };
export type DB = typeof db;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export * as t from "../../src/db/schema";
