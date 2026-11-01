import Link from "next/link";
import { DirectionTag, OutcomeBadge, RValue, StatusBadge } from "@/components/ui";
import { ago, fmtPrice } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { listAllSetups } from "@/lib/setups";
import { isEphemeralDb } from "@/lib/db";
import { logout } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdmin();
  const setups = await listAllSetups();
  return (
    <>
      <section className="page-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Dashboard</h1>
        </div>
        <div className="actions">
          <Link href="/admin/new" className="btn btn-gold">
            + New setup
          </Link>
          <form action={logout}>
            <button className="btn btn-ghost">Sign out</button>
          </form>
        </div>
      </section>

      {isEphemeralDb() && (
        <p className="warning">
          This deployment has no TURSO_DATABASE_URL, so it uses a temporary database that resets on cold start.
          Changes here will not persist.
        </p>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Side</th>
              <th>Status</th>
              <th className="num">Entry</th>
              <th className="num">Stop</th>
              <th className="num">Targets</th>
              <th className="num">Result</th>
              <th>Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {setups.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/admin/setups/${s.id}`} className="ticker-link">
                    {s.ticker}
                  </Link>
                </td>
                <td>
                  <DirectionTag direction={s.direction} />
                </td>
                <td>
                  <StatusBadge status={s.status} /> {s.status === "CLOSED" && <OutcomeBadge setup={s} />}
                </td>
                <td className="num mono">{fmtPrice(s.fill_price ?? s.entry)}</td>
                <td className="num mono">{fmtPrice(s.current_stop)}</td>
                <td className="num mono">
                  {s.targets_hit}/{s.targets.length}
                </td>
                <td className="num">{s.status === "CLOSED" ? <RValue r={s.r_multiple} /> : <span className="muted">—</span>}</td>
                <td className="muted">{ago(s.updated_at)}</td>
                <td className="num">
                  <Link href={`/admin/setups/${s.id}`} className="btn btn-sm btn-ghost">
                    {s.status === "CLOSED" ? "View" : "Update"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
