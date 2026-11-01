import type { Direction, Setup } from "./types";

export const fmtPrice = (p: number | null | undefined) =>
  p == null ? "—" : p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: p < 1 ? 4 : 2 });

export const fmtR = (r: number | null | undefined) => (r == null ? "—" : `${r > 0 ? "+" : ""}${r.toFixed(2)}R`);

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });

export const fmtDate = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : "—");
export const fmtDateTime = (iso: string) => `${dateFmt.format(new Date(iso))} · ${timeFmt.format(new Date(iso))} UTC`;

export function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Reward-to-risk of a target, measured from the planned entry and initial stop. */
export const rewardRisk = (s: Pick<Setup, "entry" | "initial_stop">, target: number) =>
  Math.abs(target - s.entry) / Math.abs(s.entry - s.initial_stop);

/** Percentage distance between two prices, signed in the trade's favour. */
export const pctMove = (direction: Direction, from: number, to: number) =>
  ((direction === "LONG" ? 1 : -1) * (to - from) * 100) / from;
