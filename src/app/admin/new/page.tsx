import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { NewSetupForm } from "./NewSetupForm";

export const metadata = { title: "New setup" };

export default async function NewSetupPage() {
  await requireAdmin();
  return (
    <>
      <Link href="/admin" className="back">
        ← Dashboard
      </Link>
      <section className="page-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>New setup</h1>
          <p className="muted">
            Levels are locked once published. Later changes (fills, targets, trailing stops) are recorded as history
            entries.
          </p>
        </div>
      </section>
      <NewSetupForm />
    </>
  );
}
