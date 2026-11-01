import Link from "next/link";
import { notFound } from "next/navigation";
import { Timeline } from "@/components/Timeline";
import { DirectionTag, OutcomeBadge, RValue, StatusBadge } from "@/components/ui";
import { fmtPrice } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { getSetup } from "@/lib/setups";
import { EventForm } from "./EventForm";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> };

export default async function AdminSetupPage({ params, searchParams }: Props) {
  await requireAdmin();
  const data = await getSetup(Number((await params).id));
  if (!data) notFound();
  const sp = await searchParams;
  const { setup: s, events } = data;
  const next =
    s.targets_hit < s.targets.length ? { index: s.targets_hit + 1, price: s.targets[s.targets_hit] } : null;

  return (
    <>
      <Link href="/admin" className="back">
        ← Dashboard
      </Link>
      <header className="setup-head">
        <h1 className="ticker-xl">{s.ticker}</h1>
        <DirectionTag direction={s.direction} />
        <StatusBadge status={s.status} />
        {s.status === "CLOSED" && <OutcomeBadge setup={s} />}
        <span className="spacer" />
        <Link href={`/setups/${s.id}`} className="btn btn-sm btn-ghost">
          View public page ↗
        </Link>
      </header>

      {(sp.created || sp.saved) && (
        <p className="flash">{sp.created ? "Setup published." : "Update appended to history."}</p>
      )}

      <dl className="stats stats-inline">
        <div>
          <dt>Entry</dt>
          <dd>{fmtPrice(s.fill_price ?? s.entry)}</dd>
        </div>
        <div>
          <dt>Current stop</dt>
          <dd className="neg-soft">{fmtPrice(s.current_stop)}</dd>
        </div>
        <div>
          <dt>Targets</dt>
          <dd className="pos-soft">{s.targets.map(fmtPrice).join(" / ")}</dd>
        </div>
        <div>
          <dt>Hit</dt>
          <dd>
            {s.targets_hit}/{s.targets.length}
          </dd>
        </div>
        {s.status === "CLOSED" && (
          <div>
            <dt>Result</dt>
            <dd>
              <RValue r={s.r_multiple} />
            </dd>
          </div>
        )}
      </dl>

      <div className="setup-layout admin-layout">
        <section className="panel">
          <h2 className="panel-title">Record an update</h2>
          <EventForm
            key={events.length}
            setupId={s.id}
            status={s.status}
            direction={s.direction}
            entry={s.entry}
            currentStop={s.current_stop}
            nextTarget={next}
          />
        </section>
        <section className="panel">
          <h2 className="panel-title">
            History <span className="count">{events.length}</span>
          </h2>
          <Timeline setup={s} events={events} />
        </section>
      </div>
    </>
  );
}
