import { createClient, type Client } from "@libsql/client";
import { seed } from "./seed";

/**
 * Database resolution:
 *  - TURSO_DATABASE_URL set  -> hosted libSQL (SQLite) database. Use this on Vercel.
 *  - running on Vercel        -> /tmp/swing.db (ephemeral, re-seeded on cold start; demo only)
 *  - otherwise                -> ./data/swing.db
 */
function resolveUrl() {
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL;
  if (process.env.VERCEL) return "file:/tmp/swing.db";
  return "file:data/swing.db";
}

export const isEphemeralDb = () => !process.env.TURSO_DATABASE_URL && !!process.env.VERCEL;

// The history is append-only: triggers reject any UPDATE or DELETE on setups,
// events and images, so a record can never be overwritten after it is written.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  mime       TEXT    NOT NULL,
  data       BLOB    NOT NULL,
  created_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS setups (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker         TEXT    NOT NULL,
  direction      TEXT    NOT NULL CHECK (direction IN ('LONG','SHORT')),
  analysis       TEXT    NOT NULL,
  entry          REAL    NOT NULL,
  initial_stop   REAL    NOT NULL,
  targets        TEXT    NOT NULL, -- JSON array of prices, nearest first
  chart_image_id INTEGER REFERENCES images(id),
  created_at     TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS setup_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  setup_id     INTEGER NOT NULL REFERENCES setups(id),
  kind         TEXT    NOT NULL CHECK (kind IN ('CREATED','STATUS','TARGET_HIT','STOP_ADJUSTED','NOTE','CLOSED')),
  status       TEXT    NOT NULL CHECK (status IN ('WATCHING','IN_PLAY','TP1_HIT','CLOSED')), -- status after this event
  stop_loss    REAL    NOT NULL, -- active stop after this event
  price        REAL,             -- fill / target / exit price where relevant
  target_index INTEGER,          -- 1-based, for TARGET_HIT
  close_reason TEXT CHECK (close_reason IN ('TARGET','STOPPED','MANUAL','INVALIDATED')),
  r_multiple   REAL,
  note         TEXT,
  image_id     INTEGER REFERENCES images(id),
  created_at   TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_setup ON setup_events(setup_id, id);

CREATE TRIGGER IF NOT EXISTS setups_immutable_u BEFORE UPDATE ON setups
BEGIN SELECT RAISE(ABORT, 'setups are immutable; append an event instead'); END;
CREATE TRIGGER IF NOT EXISTS setups_immutable_d BEFORE DELETE ON setups
BEGIN SELECT RAISE(ABORT, 'setups are immutable'); END;
CREATE TRIGGER IF NOT EXISTS events_immutable_u BEFORE UPDATE ON setup_events
BEGIN SELECT RAISE(ABORT, 'history is append-only'); END;
CREATE TRIGGER IF NOT EXISTS events_immutable_d BEFORE DELETE ON setup_events
BEGIN SELECT RAISE(ABORT, 'history is append-only'); END;
CREATE TRIGGER IF NOT EXISTS images_immutable_u BEFORE UPDATE ON images
BEGIN SELECT RAISE(ABORT, 'images are immutable'); END;
CREATE TRIGGER IF NOT EXISTS images_immutable_d BEFORE DELETE ON images
BEGIN SELECT RAISE(ABORT, 'images are immutable'); END;

-- Current state of every setup = its creation record + its latest event.
CREATE VIEW IF NOT EXISTS setup_state AS
SELECT
  s.*,
  last.status                AS status,
  last.stop_loss             AS current_stop,
  last.created_at            AS updated_at,
  (SELECT COUNT(*) FROM setup_events x WHERE x.setup_id = s.id)                         AS event_count,
  (SELECT MAX(target_index) FROM setup_events x WHERE x.setup_id = s.id AND x.kind = 'TARGET_HIT') AS targets_hit,
  (SELECT x.price FROM setup_events x WHERE x.setup_id = s.id AND x.kind = 'STATUS' AND x.status = 'IN_PLAY' ORDER BY x.id LIMIT 1) AS fill_price,
  (SELECT x.created_at FROM setup_events x WHERE x.setup_id = s.id AND x.kind = 'STATUS' AND x.status = 'IN_PLAY' ORDER BY x.id LIMIT 1) AS opened_at,
  c.price                    AS exit_price,
  c.close_reason             AS close_reason,
  c.r_multiple               AS r_multiple,
  c.created_at               AS closed_at
FROM setups s
JOIN setup_events last ON last.id = (SELECT MAX(id) FROM setup_events WHERE setup_id = s.id)
LEFT JOIN setup_events c ON c.setup_id = s.id AND c.kind = 'CLOSED';
`;

const globalForDb = globalThis as unknown as { __swingDb?: Promise<Client> };

async function init(): Promise<Client> {
  const client = createClient({
    url: resolveUrl(),
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  await client.executeMultiple(SCHEMA);
  // Seed demo data into an empty local/ephemeral database. Hosted databases are
  // seeded explicitly with `npm run db:seed` so production never gets demo rows.
  if (!process.env.TURSO_DATABASE_URL || process.env.SEED_ON_EMPTY === "1") {
    const { rows } = await client.execute("SELECT COUNT(*) AS n FROM setups");
    if (Number(rows[0].n) === 0) await seed(client);
  }
  return client;
}

export function db(): Promise<Client> {
  if (!globalForDb.__swingDb) {
    globalForDb.__swingDb = init().catch((err) => {
      globalForDb.__swingDb = undefined;
      throw err;
    });
  }
  return globalForDb.__swingDb;
}
