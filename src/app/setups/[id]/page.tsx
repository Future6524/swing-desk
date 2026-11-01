import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Timeline } from "@/components/Timeline";
import { DirectionTag, OutcomeBadge, RValue, StatusBadge } from "@/components/ui";
import { fmtDate, fmtPrice, pctMove, rewardRisk } from "@/lib/format";
import { getSetup } from "@/lib/setups";
import { CLOSE_REASON_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getSetup(Number((await params).id));
  return { title: data ? `${data.setup.ticker} ${data.setup.direction.toLowerCase()}` : "Setup not found" };
}

export default async function SetupPage({ params }: Props) {
  const data = await getSetup(Number((await params).id));
  if (!data) notFound();
  const { setup: s, events } = data;
  const closed = s.status === "CLOSED";
  const basis = s.fill_price ?? s.entry;

  return (
    <article className="setup">
      <Link href={closed ? "/archive" : "/"} className="back">
        ← {closed ? "Archive" : "Watchlist"}
      </Link>

      <header className="setup-head">
        <h1 className="ticker-xl">{s.ticker}</h1>
        <DirectionTag direction={s.direction} />
        <StatusBadge status={s.status} />
        {closed && <OutcomeBadge setup={s} />}
        <span className="spacer" />
        <span className="muted small">
          Published {fmtDate(s.created_at)} · #{s.id}
        </span>
      </header>

      <div className="setup-layout">
        <div className="setup-main">
          {s.chart_image_id && (
            <a href={`/api/images/${s.chart_image_id}`} target="_blank" rel="noreferrer" className="chart-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/images/${s.chart_image_id}`} alt={`${s.ticker} setup chart`} />
            </a>
          )}
          <section className="panel">
            <h2 className="panel-title">Analysis</h2>
            <div className="prose">
              {s.analysis.split(/\n{2,}/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
          <section className="panel">
            <h2 className="panel-title">
              History <span className="count">{events.length}</span>
            </h2>
            <Timeline setup={s} events={events} />
          </section>
        </div>

        <aside className="setup-side">
          <section className="panel">
            <h2 className="panel-title">Levels</h2>
            <table className="levels">
              <tbody>
                <tr>
                  <th>Entry</th>
                  <td className="mono gold">{fmtPrice(s.entry)}</td>
                </tr>
                {s.fill_price != null && s.fill_price !== s.entry && (
                  <tr>
                    <th>Filled</th>
                    <td className="mono">{fmtPrice(s.fill_price)}</td>
                  </tr>
                )}
                <tr>
                  <th>{s.current_stop !== s.initial_stop ? "Stop (current)" : "Stop loss"}</th>
                  <td className="mono neg-soft">{fmtPrice(s.current_stop)}</td>
                </tr>
                {s.current_stop !== s.initial_stop && (
                  <tr>
                    <th>Initial stop</th>
                    <td className="mono muted">
                      <s>{fmtPrice(s.initial_stop)}</s>
                    </td>
                  </tr>
                )}
                {s.targets.map((t, i) => {
                  const hit = i < s.targets_hit;
                  return (
                    <tr key={i} className={hit ? "hit" : ""}>
                      <th>
                        TP{i + 1} {hit && <span className="check">✓</span>}
                      </th>
                      <td className="mono pos-soft">
                        {fmtPrice(t)}
                        <span className="sub">
                          {rewardRisk(s, t).toFixed(1)}R · {pctMove(s.direction, basis, t).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <th>Risk</th>
                  <td className="mono muted">
                    {fmtPrice(Math.abs(s.entry - s.initial_stop))}
                    <span className="sub">{Math.abs(pctMove(s.direction, s.entry, s.initial_stop)).toFixed(1)}%</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {closed && (
            <section className="panel result">
              <h2 className="panel-title">Result</h2>
              <div className="result-r">
                <RValue r={s.r_multiple} />
              </div>
              <p className="muted small">
                {s.close_reason && CLOSE_REASON_LABEL[s.close_reason]}
                {s.exit_price != null && <> at {fmtPrice(s.exit_price)}</>} · {fmtDate(s.closed_at)}
              </p>
              {s.r_multiple != null && (
                <p className="muted small">R measured on the full position from fill to final exit.</p>
              )}
            </section>
          )}

          <p className="immutable-note">
            This record is append-only. Levels and updates are never edited after
            publication. Changes appear as new entries in the history.
          </p>
        </aside>
      </div>
    </article>
  );
}
