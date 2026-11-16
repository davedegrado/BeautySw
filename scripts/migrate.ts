import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../src/db";

async function main() {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✓ Database aggiornato.");
  await pool.end();
}
main().catch((e) => {
  console.error("Migrazione fallita:", e);
  process.exit(1);
});
