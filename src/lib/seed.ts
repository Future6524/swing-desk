import type { Client, Transaction } from "@libsql/client";
import { renderSetupChart } from "./chart-svg";
import type { CloseReason, Direction, Status } from "./types";

/*
 * Ten fictional setups with backdated, internally consistent histories.
 * Tickers, prices and charts are invented for demonstration only.
 */

type Step =
  | { d: number; kind: "STATUS"; price: number; note?: string }
  | { d: number; kind: "TARGET_HIT"; stop?: number; note?: string; chart?: boolean }
  | { d: number; kind: "STOP_ADJUSTED"; stop: number; note?: string }
  | { d: number; kind: "NOTE"; note: string }
  | { d: number; kind: "CLOSED"; reason: CloseReason; price?: number; note?: string };

interface SeedSetup {
  ticker: string;
  direction: Direction;
  entry: number;
  stop: number;
  targets: number[];
  created: number; // days ago
  analysis: string;
  steps: Step[];
}

const SETUPS: SeedSetup[] = [
  {
    ticker: "ORBX", direction: "LONG", entry: 48.2, stop: 45.9, targets: [52.5, 56.0], created: 2,
    analysis:
      "Tight bull flag after a high-volume breakout from a 14-week base. Volume has dried up through the flag and price is holding the rising 10-day. Trigger on a daily close above the flag high at 48.20; stop under the flag low. TP1 is the measured move of the pole, TP2 the prior swing high.",
    steps: [{ d: 1, kind: "NOTE", note: "Inside day today, range contracting further. Still waiting on the trigger." }],
  },
  {
    ticker: "KELP", direction: "SHORT", entry: 31.4, stop: 33.1, targets: [28.2, 25.8], created: 1,
    analysis:
      "Third rejection at the 33 supply zone with a lower high on the daily and bearish divergence on RSI. Sector relative strength rolling over. Short on a break of the 31.40 shelf; stop above the most recent lower high. Targets are the gap fill and the 200-day.",
    steps: [],
  },
  {
    ticker: "VANT", direction: "LONG", entry: 112.0, stop: 106.8, targets: [121.0, 128.0, 135.0], created: 9,
    analysis:
      "Cup-with-handle on the weekly; handle is shallow (6%) and forms in the upper third of the base. Earnings estimates revised up three weeks running. Buy the handle breakout at 112; stop below the handle low. Scale out across three targets.",
    steps: [
      { d: 6, kind: "STATUS", price: 112.35, note: "Triggered on 1.8x average volume. Filled slightly above the pivot." },
      { d: 3, kind: "NOTE", note: "Quiet pullback to the breakout level on light volume. Constructive; no action." },
    ],
  },
  {
    ticker: "HLX", direction: "SHORT", entry: 75.0, stop: 78.4, targets: [69.5, 64.0], created: 7,
    analysis:
      "Head-and-shoulders top with neckline at 75. Right shoulder formed on declining volume, and the stock lost its 50-day on the left shoulder decline. Short the neckline break; stop above the right shoulder.",
    steps: [
      { d: 4, kind: "STATUS", price: 74.8, note: "Neckline broke intraday, filled at 74.80." },
      { d: 1, kind: "STOP_ADJUSTED", stop: 77.2, note: "Lowered stop above the retest high. Retest of the neckline failed as expected." },
    ],
  },
  {
    ticker: "QRNT", direction: "LONG", entry: 23.0, stop: 21.4, targets: [25.6, 28.0, 31.0], created: 18,
    analysis:
      "Ascending triangle resolving after six weeks of higher lows into flat 23 resistance. Relative strength line at new highs ahead of price. Buy the breakout; stop under the last higher low.",
    steps: [
      { d: 15, kind: "STATUS", price: 23.1, note: "Breakout confirmed on the close." },
      { d: 8, kind: "TARGET_HIT", stop: 23.0, note: "TP1 reached. Took a third off; stop to breakeven.", chart: true },
      { d: 4, kind: "STOP_ADJUSTED", stop: 24.4, note: "Trailing under the new higher low." },
      { d: 1, kind: "STOP_ADJUSTED", stop: 25.9, note: "Trailing under the 10-day as the trend accelerates." },
    ],
  },
  {
    ticker: "MDRN", direction: "SHORT", entry: 142.0, stop: 149.0, targets: [133.0, 124.0], created: 12,
    analysis:
      "Failed breakout: pushed through 148 resistance and closed back inside the range the same week. Trapped longs above. Short the loss of 142 support; stop above the failed breakout high.",
    steps: [
      { d: 10, kind: "STATUS", price: 142.5, note: "Filled on the break of 142." },
      { d: 3, kind: "TARGET_HIT", stop: 142.0, note: "TP1 hit. Half off; stop to entry." },
    ],
  },
  {
    ticker: "CYPR", direction: "LONG", entry: 64.5, stop: 61.0, targets: [70.0, 76.5], created: 40,
    analysis:
      "High-tight flag: +45% in five weeks, then a three-week flag that held 15% from the high. Buy the flag breakout; stop under the flag low.",
    steps: [
      { d: 37, kind: "STATUS", price: 64.5, note: "Triggered at the pivot." },
      { d: 30, kind: "TARGET_HIT", stop: 64.5, note: "TP1 hit. Half off, stop to breakeven." },
      { d: 26, kind: "STOP_ADJUSTED", stop: 68.8, note: "Trailing under the 10-day." },
      { d: 22, kind: "TARGET_HIT", note: "TP2 hit." },
      { d: 22, kind: "CLOSED", reason: "TARGET", price: 76.5, note: "Final target reached. Closed the remaining position." },
    ],
  },
  {
    ticker: "BRIX", direction: "SHORT", entry: 18.8, stop: 19.95, targets: [17.1, 15.9], created: 33,
    analysis:
      "Bear flag under a declining 50-day following a guidance cut. Short the flag break at 18.80; stop above the flag high.",
    steps: [
      { d: 31, kind: "STATUS", price: 18.9, note: "Filled on the break." },
      { d: 28, kind: "CLOSED", reason: "STOPPED", price: 19.95, note: "Squeezed on a sector-wide upgrade. Stopped at the planned level; loss within plan." },
    ],
  },
  {
    ticker: "TALO", direction: "LONG", entry: 88.0, stop: 83.5, targets: [96.0, 102.0], created: 25,
    analysis:
      "Flat base breakout candidate. Seven weeks, 11% deep, tight weekly closes. Buy above 88 on volume.",
    steps: [
      { d: 22, kind: "NOTE", note: "Market breadth deteriorating. Watching closely." },
      { d: 20, kind: "CLOSED", reason: "INVALIDATED", note: "Undercut the base low before triggering. Setup invalidated, no position taken." },
    ],
  },
  {
    ticker: "NOVA", direction: "LONG", entry: 205.0, stop: 196.0, targets: [220.0, 238.0], created: 55,
    analysis:
      "Pullback to the rising 50-day after a gap-up on earnings. Hammer reversal off the moving average with the gap still unfilled. Buy above the hammer high.",
    steps: [
      { d: 52, kind: "STATUS", price: 205.0, note: "Triggered." },
      { d: 45, kind: "TARGET_HIT", stop: 205.0, note: "TP1 hit. Half off, stop to entry." },
      { d: 41, kind: "STOP_ADJUSTED", stop: 212.0, note: "Trailing under the higher low." },
      { d: 36, kind: "STOP_ADJUSTED", stop: 218.0, note: "Trailing tighter into extended conditions." },
      { d: 33, kind: "CLOSED", reason: "STOPPED", price: 218.0, note: "Trailing stop hit. Runner closed with profit." },
    ],
  },
];

function daysAgo(d: number, minute: number) {
  const t = new Date();
  t.setUTCDate(t.getUTCDate() - d);
  t.setUTCHours(14, 30 + minute, 0, 0); // during the US cash session
  return t.toISOString();
}

async function insertSvg(tx: Transaction, svg: string, at: string) {
  const r = await tx.execute({
    sql: "INSERT INTO images (mime, data, created_at) VALUES ('image/svg+xml', ?, ?)",
    args: [new TextEncoder().encode(svg), at],
  });
  return Number(r.lastInsertRowid);
}

export async function seed(client: Client) {
  const tx = await client.transaction("write");
  try {
    for (const [i, s] of SETUPS.entries()) {
      const created = daysAgo(s.created, i);
      const chartId = await insertSvg(
        tx,
        renderSetupChart({ seed: 1000 + i, ticker: s.ticker, direction: s.direction, entry: s.entry, stop: s.stop, targets: s.targets }),
        created,
      );
      const r = await tx.execute({
        sql: `INSERT INTO setups (ticker, direction, analysis, entry, initial_stop, targets, chart_image_id, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [s.ticker, s.direction, s.analysis, s.entry, s.stop, JSON.stringify(s.targets), chartId, created],
      });
      const id = Number(r.lastInsertRowid);
      await tx.execute({
        sql: `INSERT INTO setup_events (setup_id, kind, status, stop_loss, image_id, created_at) VALUES (?, 'CREATED', 'WATCHING', ?, ?, ?)`,
        args: [id, s.stop, chartId, created],
      });

      // Replay the steps, tracking state exactly as appendEvent would.
      let status: Status = "WATCHING";
      let stop = s.stop;
      let fill = s.entry;
      let hit = 0;
      for (const [j, st] of s.steps.entries()) {
        const at = daysAgo(st.d, i + j + 1);
        let price: number | null = null;
        let target: number | null = null;
        let reason: CloseReason | null = null;
        let rm: number | null = null;
        let image: number | null = null;
        switch (st.kind) {
          case "STATUS":
            status = "IN_PLAY";
            price = fill = st.price;
            break;
          case "TARGET_HIT":
            status = "TP1_HIT";
            target = ++hit;
            price = s.targets[hit - 1];
            if (st.stop != null) stop = st.stop;
            if (st.chart)
              image = await insertSvg(
                tx,
                renderSetupChart({ seed: 2000 + i, ticker: s.ticker, direction: s.direction, entry: price, stop, targets: s.targets.slice(hit), candles: 80, caption: `TP${hit} hit`, entryLabel: `TP${hit}`, targetOffset: hit }),
                at,
              );
            break;
          case "STOP_ADJUSTED":
            stop = st.stop;
            break;
          case "CLOSED":
            status = "CLOSED";
            reason = st.reason;
            if (st.price != null) {
              price = st.price;
              const dir = s.direction === "LONG" ? 1 : -1;
              rm = Math.round(((dir * (st.price - fill)) / Math.abs(s.entry - s.stop)) * 100) / 100;
            }
            break;
        }
        await tx.execute({
          sql: `INSERT INTO setup_events
                  (setup_id, kind, status, stop_loss, price, target_index, close_reason, r_multiple, note, image_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [id, st.kind, status, stop, price, target, reason, rm, st.note ?? null, image, at],
        });
      }
    }
    await tx.commit();
  } finally {
    tx.close();
  }
}
