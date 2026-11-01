/**
 * Wipes and re-seeds the database with the 10 demo setups.
 *   npm run db:seed                  -> ./data/swing.db
 *   TURSO_DATABASE_URL=... npm run db:seed -> hosted database (destroys its data!)
 */
import { createClient } from "@libsql/client";
import { SCHEMA } from "../src/lib/db";
import { seed } from "../src/lib/seed";

async function main() {
  const url = process.env.TURSO_DATABASE_URL ?? "file:data/swing.db";
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  if (process.argv.includes("--reset")) {
    // DROP bypasses the append-only triggers; this is the one deliberate escape hatch.
    await client.executeMultiple(`
      DROP VIEW IF EXISTS setup_state;
      DROP TABLE IF EXISTS setup_events;
      DROP TABLE IF EXISTS setups;
      DROP TABLE IF EXISTS images;
    `);
  }
  await client.executeMultiple(SCHEMA);
  await seed(client);
  const { rows } = await client.execute("SELECT status, COUNT(*) n FROM setup_state GROUP BY status");
  console.log(`Seeded ${url}`);
  console.table(rows.map((r) => ({ status: r.status, count: Number(r.n) })));
  client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
