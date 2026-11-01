import type { Direction } from "./types";

/** Deterministic PRNG so seeded charts look the same on every reseed. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ChartSpec {
  seed: number;
  ticker: string;
  direction: Direction;
  entry: number;
  stop: number;
  targets: number[];
  candles?: number;
  caption?: string;
  entryLabel?: string;
  /** Number of targets already hit, so remaining ones keep their TPn labels. */
  targetOffset?: number;
}

/**
 * Renders an illustrative daily candlestick chart (fictional price action) that
 * builds into the setup's entry, with entry / stop / target levels drawn on it.
 */
export function renderSetupChart(spec: ChartSpec): string {
  const rand = mulberry32(spec.seed);
  const n = spec.candles ?? 64;
  const long = spec.direction === "LONG";
  const risk = Math.abs(spec.entry - spec.stop);

  // Random walk with a pullback-then-push shape toward the trigger.
  const raw: number[] = [0];
  for (let i = 1; i < n; i++) {
    const phase = i / n;
    const drift = phase < 0.45 ? 0.35 : phase < 0.75 ? -0.25 : 0.45;
    raw.push(raw[i - 1] + drift + (rand() - 0.5) * 2.2);
  }
  // Affine-map the walk between the levels: its weakest point lands just inside the
  // stop and its strongest point just short of the entry trigger (mirrored for shorts).
  const rawLo = Math.min(...raw);
  const rawHi = Math.max(...raw);
  const nearStop = long ? spec.stop + risk * 0.15 : spec.stop - risk * 0.15;
  const nearEntry = long ? spec.entry - risk * 0.04 : spec.entry + risk * 0.04;
  const closes = raw.map((v) => nearStop + ((v - rawLo) / (rawHi - rawLo || 1)) * (nearEntry - nearStop));

  const vol = risk * 0.22;
  const candles = closes.map((c, i) => {
    const o = i === 0 ? c - (rand() - 0.5) * vol : closes[i - 1] + (rand() - 0.5) * vol * 0.6;
    const h = Math.max(o, c) + rand() * vol;
    const l = Math.min(o, c) - rand() * vol;
    return { o, h, l, c };
  });

  const W = 960, H = 480, padL = 16, padR = 92, padT = 44, padB = 28;
  const levels = [spec.entry, spec.stop, ...spec.targets];
  let lo = Math.min(...candles.map((k) => k.l), ...levels);
  let hi = Math.max(...candles.map((k) => k.h), ...levels);
  const span = hi - lo;
  lo -= span * 0.06;
  hi += span * 0.06;
  const y = (p: number) => padT + ((hi - p) / (hi - lo)) * (H - padT - padB);
  const plotW = W - padL - padR;
  const step = plotW / (n + 6); // leave room on the right for projection
  const bw = step * 0.62;

  const fmt = (p: number) => p.toFixed(2);
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">`,
    `<rect width="${W}" height="${H}" fill="#111112"/>`,
  );
  // grid
  for (let i = 0; i <= 6; i++) {
    const gy = padT + (i / 6) * (H - padT - padB);
    const p = hi - (i / 6) * (hi - lo);
    parts.push(
      `<line x1="${padL}" x2="${W - padR}" y1="${gy}" y2="${gy}" stroke="#1f1f21" stroke-width="1"/>`,
      `<text x="${W - padR + 8}" y="${gy + 4}" fill="#55524c" font-size="11">${fmt(p)}</text>`,
    );
  }
  for (let i = 0; i < n; i += 8) {
    const gx = padL + i * step + step / 2;
    parts.push(`<line x1="${gx}" x2="${gx}" y1="${padT}" y2="${H - padB}" stroke="#18181a" stroke-width="1"/>`);
  }
  // candles
  candles.forEach((k, i) => {
    const x = padL + i * step + step / 2;
    const up = k.c >= k.o;
    const col = up ? "#5f9e80" : "#b85c55";
    const top = y(Math.max(k.o, k.c));
    const bh = Math.max(1, Math.abs(y(k.o) - y(k.c)));
    parts.push(
      `<line x1="${x}" x2="${x}" y1="${y(k.h)}" y2="${y(k.l)}" stroke="${col}" stroke-width="1"/>`,
      `<rect x="${x - bw / 2}" y="${top}" width="${bw}" height="${bh}" fill="${up ? "#111112" : col}" stroke="${col}" stroke-width="1"/>`,
    );
  });
  // levels
  const level = (p: number, color: string, label: string, dash: string) => {
    const ly = y(p);
    parts.push(
      `<line x1="${padL}" x2="${W - padR}" y1="${ly}" y2="${ly}" stroke="${color}" stroke-width="1.2" stroke-dasharray="${dash}" opacity="0.9"/>`,
      `<rect x="${W - padR + 2}" y="${ly - 10}" width="${padR - 6}" height="20" rx="3" fill="${color}"/>`,
      `<text x="${W - padR + 8}" y="${ly + 4}" fill="#0b0b0c" font-size="11" font-weight="700">${fmt(p)}</text>`,
      `<text x="${W - padR - 8}" y="${ly - 6}" fill="${color}" font-size="11" text-anchor="end">${label}</text>`,
    );
  };
  spec.targets.forEach((t, i) => level(t, "#7fae94", `TP${i + 1 + (spec.targetOffset ?? 0)}`, "2 4"));
  level(spec.stop, "#c46a62", "STOP", "6 4");
  level(spec.entry, "#c9a961", spec.entryLabel ?? "ENTRY", "0");

  parts.push(
    `<text x="${padL + 4}" y="26" fill="#e8e4da" font-size="17" font-weight="700" letter-spacing="1">${spec.ticker}</text>`,
    `<text x="${padL + 4 + spec.ticker.length * 12 + 14}" y="26" fill="#8a857a" font-size="12">1D · ${spec.direction}${spec.caption ? " · " + spec.caption : ""}</text>`,
    `<text x="${W - padR - 8}" y="26" fill="#3a3834" font-size="11" text-anchor="end">illustrative · fictional data</text>`,
    `</svg>`,
  );
  return parts.join("");
}
