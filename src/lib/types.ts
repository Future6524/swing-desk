export type Direction = "LONG" | "SHORT";
export type Status = "WATCHING" | "IN_PLAY" | "TP1_HIT" | "CLOSED";
export type EventKind = "CREATED" | "STATUS" | "TARGET_HIT" | "STOP_ADJUSTED" | "NOTE" | "CLOSED";
export type CloseReason = "TARGET" | "STOPPED" | "MANUAL" | "INVALIDATED";
export type Outcome = "WIN" | "LOSS" | "BREAKEVEN" | "INVALIDATED";

export const STATUS_LABEL: Record<Status, string> = {
  WATCHING: "Watching",
  IN_PLAY: "In Play",
  TP1_HIT: "TP1 Hit",
  CLOSED: "Closed",
};

export const CLOSE_REASON_LABEL: Record<CloseReason, string> = {
  TARGET: "Final target",
  STOPPED: "Stopped out",
  MANUAL: "Manual exit",
  INVALIDATED: "Invalidated",
};

export interface Setup {
  id: number;
  ticker: string;
  direction: Direction;
  analysis: string;
  entry: number;
  initial_stop: number;
  targets: number[];
  chart_image_id: number | null;
  created_at: string;
  status: Status;
  current_stop: number;
  updated_at: string;
  event_count: number;
  targets_hit: number;
  fill_price: number | null;
  opened_at: string | null;
  exit_price: number | null;
  close_reason: CloseReason | null;
  r_multiple: number | null;
  closed_at: string | null;
}

export interface SetupEvent {
  id: number;
  setup_id: number;
  kind: EventKind;
  status: Status;
  stop_loss: number;
  price: number | null;
  target_index: number | null;
  close_reason: CloseReason | null;
  r_multiple: number | null;
  note: string | null;
  image_id: number | null;
  created_at: string;
}

export function outcomeOf(s: Pick<Setup, "close_reason" | "r_multiple">): Outcome | null {
  if (!s.close_reason) return null;
  if (s.close_reason === "INVALIDATED" || s.r_multiple == null) return "INVALIDATED";
  if (s.r_multiple > 0.05) return "WIN";
  if (s.r_multiple < -0.05) return "LOSS";
  return "BREAKEVEN";
}
