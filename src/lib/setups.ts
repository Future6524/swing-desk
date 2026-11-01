import type { InArgs, Row, Transaction } from "@libsql/client";
import { db } from "./db";
import type { CloseReason, Direction, Outcome, Setup, SetupEvent, Status } from "./types";

/** A rule violation the admin can fix (bad levels, illegal transition, ...). */
export class DomainError extends Error {}

const num = (v: unknown) => (v == null ? null : Number(v));

function toSetup(r: Row): Setup {
  return {
    id: Number(r.id),
    ticker: String(r.ticker),
    direction: r.direction as Direction,
    analysis: String(r.analysis),
    entry: Number(r.entry),
    initial_stop: Number(r.initial_stop),
    targets: JSON.parse(String(r.targets)),
    chart_image_id: num(r.chart_image_id),
    created_at: String(r.created_at),
    status: r.status as Status,
    current_stop: Number(r.current_stop),
    updated_at: String(r.updated_at),
    event_count: Number(r.event_count),
    targets_hit: Number(r.targets_hit ?? 0),
    fill_price: num(r.fill_price),
    opened_at: (r.opened_at as string) ?? null,
    exit_price: num(r.exit_price),
    close_reason: (r.close_reason as CloseReason) ?? null,
    r_multiple: num(r.r_multiple),
    closed_at: (r.closed_at as string) ?? null,
  };
}

function toEvent(r: Row): SetupEvent {
  return {
    id: Number(r.id),
    setup_id: Number(r.setup_id),
    kind: r.kind as SetupEvent["kind"],
    status: r.status as Status,
    stop_loss: Number(r.stop_loss),
    price: num(r.price),
    target_index: num(r.target_index),
    close_reason: (r.close_reason as CloseReason) ?? null,
    r_multiple: num(r.r_multiple),
    note: (r.note as string) ?? null,
    image_id: num(r.image_id),
    created_at: String(r.created_at),
  };
}

// ---------------------------------------------------------------- queries

export async function listActiveSetups(): Promise<Setup[]> {
  const c = await db();
  const { rows } = await c.execute(
    `SELECT * FROM setup_state WHERE status != 'CLOSED'
     ORDER BY CASE status WHEN 'TP1_HIT' THEN 0 WHEN 'IN_PLAY' THEN 1 ELSE 2 END, updated_at DESC`,
  );
  return rows.map(toSetup);
}

export async function listAllSetups(): Promise<Setup[]> {
  const c = await db();
  const { rows } = await c.execute(
    `SELECT * FROM setup_state ORDER BY (status = 'CLOSED'), updated_at DESC`,
  );
  return rows.map(toSetup);
}

export interface ArchiveFilters {
  q?: string;
  direction?: Direction;
  outcome?: Outcome;
  from?: string; // yyyy-mm-dd, closed on or after
  to?: string; // yyyy-mm-dd, closed on or before
  sort?: "recent" | "oldest" | "best" | "worst";
}

const OUTCOME_SQL: Record<Outcome, string> = {
  WIN: "r_multiple > 0.05",
  LOSS: "r_multiple < -0.05",
  BREAKEVEN: "r_multiple BETWEEN -0.05 AND 0.05",
  INVALIDATED: "(close_reason = 'INVALIDATED' OR r_multiple IS NULL)",
};

const SORT_SQL = {
  recent: "closed_at DESC",
  oldest: "closed_at ASC",
  best: "r_multiple IS NULL, r_multiple DESC",
  worst: "r_multiple IS NULL, r_multiple ASC",
};

export async function listClosedSetups(f: ArchiveFilters): Promise<Setup[]> {
  const where = ["status = 'CLOSED'"];
  const args: InArgs = [];
  if (f.q) {
    where.push("(ticker LIKE ? OR analysis LIKE ?)");
    const like = `%${f.q.replace(/[%_]/g, "")}%`;
    args.push(like, like);
  }
  if (f.direction) {
    where.push("direction = ?");
    args.push(f.direction);
  }
  if (f.outcome) where.push(OUTCOME_SQL[f.outcome]);
  if (f.from) {
    where.push("closed_at >= ?");
    args.push(f.from);
  }
  if (f.to) {
    where.push("closed_at < date(?, '+1 day')");
    args.push(f.to);
  }
  const c = await db();
  const { rows } = await c.execute({
    sql: `SELECT * FROM setup_state WHERE ${where.join(" AND ")} ORDER BY ${SORT_SQL[f.sort ?? "recent"]}`,
    args,
  });
  return rows.map(toSetup);
}

export async function getSetup(id: number): Promise<{ setup: Setup; events: SetupEvent[] } | null> {
  if (!Number.isInteger(id)) return null;
  const c = await db();
  const [s, e] = await c.batch(
    [
      { sql: "SELECT * FROM setup_state WHERE id = ?", args: [id] },
      { sql: "SELECT * FROM setup_events WHERE setup_id = ? ORDER BY id", args: [id] },
    ],
    "read",
  );
  if (!s.rows.length) return null;
  return { setup: toSetup(s.rows[0]), events: e.rows.map(toEvent) };
}

export async function getStats() {
  const c = await db();
  const { rows } = await c.execute(`
    SELECT
      SUM(status != 'CLOSED') AS active,
      SUM(status = 'CLOSED' AND r_multiple IS NOT NULL) AS traded,
      SUM(status = 'CLOSED' AND r_multiple > 0.05) AS wins,
      SUM(CASE WHEN status = 'CLOSED' THEN r_multiple END) AS total_r
    FROM setup_state`);
  const r = rows[0];
  const traded = Number(r.traded ?? 0);
  return {
    active: Number(r.active ?? 0),
    traded,
    winRate: traded ? Number(r.wins) / traded : null,
    totalR: Number(r.total_r ?? 0),
  };
}

export async function getImage(id: number): Promise<{ mime: string; data: ArrayBuffer } | null> {
  const c = await db();
  const { rows } = await c.execute({ sql: "SELECT mime, data FROM images WHERE id = ?", args: [id] });
  if (!rows.length) return null;
  return { mime: String(rows[0].mime), data: rows[0].data as ArrayBuffer };
}

// -------------------------------------------------------------- mutations

const now = () => new Date().toISOString();
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export interface ImageInput {
  mime: string;
  data: Uint8Array;
}

async function insertImage(tx: Transaction, img: ImageInput, at: string) {
  const r = await tx.execute({
    sql: "INSERT INTO images (mime, data, created_at) VALUES (?, ?, ?)",
    args: [img.mime, img.data, at],
  });
  return Number(r.lastInsertRowid);
}

export interface NewSetupInput {
  ticker: string;
  direction: Direction;
  analysis: string;
  entry: number;
  stop: number;
  targets: number[];
  chart?: ImageInput;
}

/** Validates levels and returns targets ordered nearest-first. */
export function validateLevels(direction: Direction, entry: number, stop: number, targets: number[]) {
  const vals = [entry, stop, ...targets];
  if (vals.some((v) => !Number.isFinite(v) || v <= 0)) throw new DomainError("All prices must be positive numbers.");
  if (!targets.length) throw new DomainError("Add at least one target.");
  const long = direction === "LONG";
  if (long ? stop >= entry : stop <= entry)
    throw new DomainError(`Stop loss must be ${long ? "below" : "above"} entry for a ${direction.toLowerCase()}.`);
  if (targets.some((t) => (long ? t <= entry : t >= entry)))
    throw new DomainError(`Targets must be ${long ? "above" : "below"} entry for a ${direction.toLowerCase()}.`);
  return [...targets].sort((a, b) => (long ? a - b : b - a));
}

export async function createSetup(input: NewSetupInput): Promise<number> {
  const ticker = input.ticker.trim().toUpperCase();
  if (!/^[A-Z0-9.\-]{1,12}$/.test(ticker)) throw new DomainError("Ticker must be 1–12 letters/digits.");
  if (!input.analysis.trim()) throw new DomainError("Analysis is required.");
  const targets = validateLevels(input.direction, input.entry, input.stop, input.targets);

  const c = await db();
  const tx = await c.transaction("write");
  try {
    const at = now();
    const imageId = input.chart ? await insertImage(tx, input.chart, at) : null;
    const r = await tx.execute({
      sql: `INSERT INTO setups (ticker, direction, analysis, entry, initial_stop, targets, chart_image_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [ticker, input.direction, input.analysis.trim(), input.entry, input.stop, JSON.stringify(targets), imageId, at],
    });
    const id = Number(r.lastInsertRowid);
    await tx.execute({
      sql: `INSERT INTO setup_events (setup_id, kind, status, stop_loss, image_id, created_at)
            VALUES (?, 'CREATED', 'WATCHING', ?, ?, ?)`,
      args: [id, input.stop, imageId, at],
    });
    await tx.commit();
    return id;
  } finally {
    tx.close();
  }
}

export type EventInput =
  | { kind: "STATUS"; price?: number; note?: string; image?: ImageInput } // WATCHING -> IN_PLAY
  | { kind: "TARGET_HIT"; price?: number; stop?: number; note?: string; image?: ImageInput }
  | { kind: "STOP_ADJUSTED"; stop: number; note?: string; image?: ImageInput }
  | { kind: "NOTE"; note: string; image?: ImageInput }
  | { kind: "CLOSED"; reason: CloseReason; price?: number; note?: string; image?: ImageInput };

/** R multiple realised by exiting at `exit`, measured against the planned risk. */
export function rMultiple(s: Pick<Setup, "direction" | "entry" | "initial_stop" | "fill_price">, exit: number) {
  const basis = s.fill_price ?? s.entry;
  const risk = Math.abs(s.entry - s.initial_stop);
  const dir = s.direction === "LONG" ? 1 : -1;
  return round((dir * (exit - basis)) / risk);
}

function assertTighter(s: Setup, stop: number) {
  if (!Number.isFinite(stop) || stop <= 0) throw new DomainError("Stop must be a positive number.");
  const long = s.direction === "LONG";
  if (s.status === "WATCHING") {
    if (long ? stop >= s.entry : stop <= s.entry)
      throw new DomainError(`Stop must stay ${long ? "below" : "above"} entry while watching.`);
    return;
  }
  // Once a trade is live the stop only trails in the trade's favour.
  if (long ? stop <= s.current_stop : stop >= s.current_stop)
    throw new DomainError(
      `Trailing stop can only move ${long ? "up" : "down"} (current ${s.current_stop}).`,
    );
}

/**
 * Appends one event to a setup's history. Validation reads the latest state inside
 * the same write transaction, so concurrent admins can't produce an invalid sequence.
 */
export async function appendEvent(setupId: number, input: EventInput): Promise<void> {
  const c = await db();
  const tx = await c.transaction("write");
  try {
    const { rows } = await tx.execute({ sql: "SELECT * FROM setup_state WHERE id = ?", args: [setupId] });
    if (!rows.length) throw new DomainError("Setup not found.");
    const s = toSetup(rows[0]);
    const note = input.note?.trim() || null;
    if (s.status === "CLOSED" && input.kind !== "NOTE")
      throw new DomainError("This setup is closed. Only notes can be added.");

    let status: Status = s.status;
    let stop = s.current_stop;
    let price: number | null = null;
    let targetIndex: number | null = null;
    let reason: CloseReason | null = null;
    let r: number | null = null;

    switch (input.kind) {
      case "STATUS":
        if (s.status !== "WATCHING") throw new DomainError("Only a watched setup can be moved to In Play.");
        status = "IN_PLAY";
        price = input.price ?? s.entry;
        break;
      case "TARGET_HIT": {
        if (s.status !== "IN_PLAY" && s.status !== "TP1_HIT")
          throw new DomainError("Targets can only be hit while the trade is in play.");
        targetIndex = s.targets_hit + 1;
        if (targetIndex > s.targets.length) throw new DomainError("All targets have already been hit.");
        status = "TP1_HIT";
        price = input.price ?? s.targets[targetIndex - 1];
        if (input.stop != null) {
          assertTighter(s, input.stop);
          stop = input.stop;
        }
        break;
      }
      case "STOP_ADJUSTED":
        assertTighter(s, input.stop);
        stop = input.stop;
        break;
      case "NOTE":
        if (!note && !input.image) throw new DomainError("A note needs text or a chart.");
        break;
      case "CLOSED":
        status = "CLOSED";
        reason = input.reason;
        if (s.status === "WATCHING") {
          if (reason !== "INVALIDATED") throw new DomainError("A setup that never triggered can only be invalidated.");
        } else {
          if (reason === "INVALIDATED") throw new DomainError("A live trade must be closed with an exit price.");
          price = input.price ?? (reason === "STOPPED" ? s.current_stop : NaN);
          if (!Number.isFinite(price) || price <= 0) throw new DomainError("Exit price is required.");
          r = rMultiple(s, price);
        }
        break;
    }

    const at = now();
    const imageId = input.image ? await insertImage(tx, input.image, at) : null;
    await tx.execute({
      sql: `INSERT INTO setup_events
              (setup_id, kind, status, stop_loss, price, target_index, close_reason, r_multiple, note, image_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [setupId, input.kind, status, stop, price, targetIndex, reason, r, note, imageId, at],
    });
    await tx.commit();
  } finally {
    tx.close();
  }
}
