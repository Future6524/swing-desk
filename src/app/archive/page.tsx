import Link from "next/link";
import { DirectionTag, OutcomeBadge, RValue } from "@/components/ui";
import { fmtDate, fmtPrice, fmtR } from "@/lib/format";
import { listClosedSetups, type ArchiveFilters } from "@/lib/setups";
import { CLOSE_REASON_LABEL, outcomeOf, type Direction, type Outcome } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Archive" };

type Search = Record<string, string | string[] | undefined>;

function parse(sp: Search): ArchiveFilters {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const date = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(one(k)) ? one(k) : undefined);
  const pick = <T extends string>(k: string, allowed: readonly T[]) =>
    allowed.includes(one(k) as T) ? (one(k) as T) : undefined;
  return {
    q: one("q").slice(0, 60) || undefined,
    direction: pick<Direction>("direction", ["LONG", "SHORT"]),
    outcome: pick<Outcome>("outcome", ["WIN", "LOSS", "BREAKEVEN", "INVALIDATED"]),
    from: date("from"),
    to: date("to"),
    sort: pick("sort", ["recent", "oldest", "best", "worst"] as const),
  };
}

export default async function ArchivePage({ searchParams }: { searchParams: Promise<Search> }) {
  const f = parse(await searchParams);
  const rows = await listClosedSetups(f);
  const traded = rows.filter((r) => r.r_multiple != null);
  const wins = traded.filter((r) => outcomeOf(r) === "WIN").length;
  const net = traded.reduce((a, r) => a + (r.r_multiple ?? 0), 0);
  const filtered = Object.values(f).some(Boolean);

  return (
    <>
      <section className="page-head">
        <div>
          <p className="eyebrow">Archive</p>
          <h1>Closed setups</h1>
        </div>
      </section>

      <form className="filters" method="get">
        <input type="search" name="q" defaultValue={f.q} placeholder="Search ticker or analysis…" aria-label="Search" />
        <select name="direction" defaultValue={f.direction ?? ""} aria-label="Direction">
          <option value="">All directions</option>
          <option value="LONG">Long</option>
          <option value="SHORT">Short</option>
        </select>
        <select name="outcome" defaultValue={f.outcome ?? ""} aria-label="Outcome">
          <option value="">All outcomes</option>
          <option value="WIN">Wins</option>
          <option value="LOSS">Losses</option>
          <option value="BREAKEVEN">Scratches</option>
          <option value="INVALIDATED">Invalidated</option>
        </select>
        <label className="date-field">
          <span>Closed from</span>
          <input type="date" name="from" defaultValue={f.from} />
        </label>
        <label className="date-field">
          <span>to</span>
          <input type="date" name="to" defaultValue={f.to} />
        </label>
        <select name="sort" defaultValue={f.sort ?? "recent"} aria-label="Sort">
          <option value="recent">Most recent</option>
          <option value="oldest">Oldest</option>
          <option value="best">Best R</option>
          <option value="worst">Worst R</option>
        </select>
        <button type="submit" className="btn btn-gold">Apply</button>
        {filtered && (
          <Link href="/archive" className="btn btn-ghost">
            Reset
          </Link>
        )}
      </form>

      <p className="summary">
        <strong>{rows.length}</strong> setup{rows.length === 1 ? "" : "s"}
        {traded.length > 0 && (
          <>
            {" "}· {traded.length} traded · win rate <strong>{Math.round((wins / traded.length) * 100)}%</strong> · net{" "}
            <strong className={net >= 0 ? "pos" : "neg"}>{fmtR(net)}</strong>
          </>
        )}
      </p>

      {rows.length === 0 ? (
        <p className="empty">No closed setups match these filters.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Side</th>
                <th>Published</th>
                <th>Closed</th>
                <th className="num">Entry</th>
                <th className="num">Exit</th>
                <th>Reason</th>
                <th className="num">Result</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/setups/${s.id}`} className="ticker-link">
                      {s.ticker}
                    </Link>
                  </td>
                  <td>
                    <DirectionTag direction={s.direction} />
                  </td>
                  <td className="muted">{fmtDate(s.created_at)}</td>
                  <td className="muted">{fmtDate(s.closed_at)}</td>
                  <td className="num mono">{fmtPrice(s.fill_price ?? s.entry)}</td>
                  <td className="num mono">{fmtPrice(s.exit_price)}</td>
                  <td className="muted">{s.close_reason && CLOSE_REASON_LABEL[s.close_reason]}</td>
                  <td className="num">
                    <RValue r={s.r_multiple} />
                  </td>
                  <td>
                    <OutcomeBadge setup={s} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
