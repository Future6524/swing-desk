import Link from "next/link";
import { ago, fmtPrice, fmtR, rewardRisk } from "@/lib/format";
import { outcomeOf, STATUS_LABEL, type Direction, type Outcome, type Setup, type Status } from "@/lib/types";

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge status-${status.toLowerCase()}`}>{STATUS_LABEL[status]}</span>;
}

export function DirectionTag({ direction }: { direction: Direction }) {
  return (
    <span className={`dir dir-${direction.toLowerCase()}`}>
      {direction === "LONG" ? "▲" : "▼"} {direction}
    </span>
  );
}

const OUTCOME_LABEL: Record<Outcome, string> = { WIN: "Win", LOSS: "Loss", BREAKEVEN: "Scratch", INVALIDATED: "Invalidated" };

export function OutcomeBadge({ setup }: { setup: Pick<Setup, "close_reason" | "r_multiple"> }) {
  const o = outcomeOf(setup);
  if (!o) return null;
  return <span className={`badge outcome-${o.toLowerCase()}`}>{OUTCOME_LABEL[o]}</span>;
}

export function RValue({ r }: { r: number | null }) {
  const cls = r == null ? "muted" : r > 0.05 ? "pos" : r < -0.05 ? "neg" : "muted";
  return <span className={`mono ${cls}`}>{fmtR(r)}</span>;
}

export function SetupCard({ s }: { s: Setup }) {
  const next = s.targets[s.targets_hit] ?? s.targets[s.targets.length - 1];
  return (
    <Link href={`/setups/${s.id}`} className="card setup-card">
      {s.chart_image_id && (
        <div className="card-chart">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/images/${s.chart_image_id}`} alt={`${s.ticker} chart`} loading="lazy" />
        </div>
      )}
      <div className="card-body">
        <div className="card-head">
          <span className="ticker">{s.ticker}</span>
          <DirectionTag direction={s.direction} />
          <span className="spacer" />
          <StatusBadge status={s.status} />
        </div>
        <dl className="levels-mini">
          <div>
            <dt>Entry</dt>
            <dd className="mono">{fmtPrice(s.fill_price ?? s.entry)}</dd>
          </div>
          <div>
            <dt>Stop</dt>
            <dd className="mono neg-soft">{fmtPrice(s.current_stop)}</dd>
          </div>
          <div>
            <dt>{s.targets_hit < s.targets.length ? `TP${s.targets_hit + 1}` : "Final TP"}</dt>
            <dd className="mono pos-soft">{fmtPrice(next)}</dd>
          </div>
          <div>
            <dt>R:R</dt>
            <dd className="mono">{rewardRisk(s, next).toFixed(1)}</dd>
          </div>
        </dl>
        <div className="card-foot">
          <span>
            {s.targets_hit}/{s.targets.length} targets
          </span>
          <span>Updated {ago(s.updated_at)}</span>
        </div>
      </div>
    </Link>
  );
}
