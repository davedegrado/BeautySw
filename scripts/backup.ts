import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { pool } from "../src/db";
import { exportAll } from "../src/lib/backup";

/** Backup completo di tutti i centri in formato JSON: `npm run db:backup`. */
async function main() {
  const data = await exportAll();
  mkdirSync("backups", { recursive: true });
  const file = `backups/backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(file, JSON.stringify(data));
  console.log(`✓ Backup salvato in ${file}`);
  await pool.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
