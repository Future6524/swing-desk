import { adminPassword } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin sign in" };

export default function LoginPage() {
  const configured = adminPassword() != null;
  return (
    <div className="auth">
      <div className="panel auth-panel">
        <p className="eyebrow">Admin</p>
        <h1>Sign in</h1>
        {configured ? (
          <LoginForm />
        ) : (
          <p className="error">Admin is disabled: set the ADMIN_PASSWORD environment variable.</p>
        )}
        {process.env.NODE_ENV !== "production" && !process.env.ADMIN_PASSWORD && (
          <p className="muted small">Local dev: ADMIN_PASSWORD is unset, so the password is “admin”.</p>
        )}
      </div>
    </div>
  );
}
