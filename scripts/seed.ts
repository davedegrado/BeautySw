import "dotenv/config";
import { pool } from "../src/db";
import { DEMO_PASSWORD, seedDemoCenter } from "../src/db/seed-demo";

/** Dati dimostrativi: `npm run db:seed` (aggiungi `-- --reset` per ricreare il centro demo). */
async function main() {
  const center = await seedDemoCenter({ reset: process.argv.includes("--reset") });
  if (!center) {
    console.log("Il centro demo esiste già. Usa `npm run db:seed -- --reset` per ricrearlo.");
    return pool.end();
  }
  console.log(`✓ Centro demo "${center.name}" creato.\n`);
  console.log("  Account demo (password per tutti: " + DEMO_PASSWORD + ")");
  console.log("  Amministratore  admin@aurea.demo");
  console.log("  Dipendenti      giulia@aurea.demo · sofia@aurea.demo · martina@aurea.demo");
  console.log("  Clienti         elena@aurea.demo · chiara@aurea.demo · francesca@aurea.demo …");
  await pool.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
