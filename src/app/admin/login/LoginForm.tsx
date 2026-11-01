"use client";

import { useActionState } from "react";
import { login } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="form">
      <label className="field">
        <span>Password</span>
        <input type="password" name="password" autoComplete="current-password" required autoFocus />
      </label>
      {state?.error && <p className="error">{state.error}</p>}
      <button className="btn btn-gold" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
