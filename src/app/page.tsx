import { SetupCard } from "@/components/ui";
import { fmtR } from "@/lib/format";
import { getStats, listActiveSetups } from "@/lib/setups";
import type { Status } from "@/lib/types";

export const dynamic = "force-dynamic";

const SECTIONS: { status: Status; title: string; blurb: string }[] = [
  { status: "TP1_HIT", title: "TP1 Hit", blurb: "Partial profits taken, stop trailing" },
  { status: "IN_PLAY", title: "In Play", blurb: "Triggered and live" },
  { status: "WATCHING", title: "Watching", blurb: "Waiting for the trigger" },
];

export default async function WatchlistPage() {
  const [setups, stats] = await Promise.all([listActiveSetups(), getStats()]);
  return (
    <>
      <section className="page-head">
        <div>
          <p className="eyebrow">Watchlist</p>
          <h1>Active setups</h1>
        </div>
        <dl className="stats">
          <div>
            <dt>Active</dt>
            <dd>{stats.active}</dd>
          </div>
          <div>
            <dt>Closed trades</dt>
            <dd>{stats.traded}</dd>
          </div>
          <div>
            <dt>Win rate</dt>
            <dd>{stats.winRate == null ? "—" : `${Math.round(stats.winRate * 100)}%`}</dd>
          </div>
          <div>
            <dt>Net result</dt>
            <dd className={stats.totalR >= 0 ? "pos" : "neg"}>{fmtR(stats.totalR)}</dd>
          </div>
        </dl>
      </section>

      {setups.length === 0 && <p className="empty">No active setups right now.</p>}

      {SECTIONS.map(({ status, title, blurb }) => {
        const group = setups.filter((s) => s.status === status);
        if (!group.length) return null;
        return (
          <section key={status} className="group">
            <h2 className="group-title">
              {title} <span className="count">{group.length}</span>
              <span className="group-blurb">{blurb}</span>
            </h2>
            <div className="grid">
              {group.map((s) => (
                <SetupCard key={s.id} s={s} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
