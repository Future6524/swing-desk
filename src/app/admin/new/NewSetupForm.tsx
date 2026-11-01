"use client";

import { useActionState, useState } from "react";
import { ChartInput } from "@/components/ChartInput";
import { createSetupAction } from "../actions";

export function NewSetupForm() {
  const [state, action, pending] = useActionState(createSetupAction, undefined);
  const [direction, setDirection] = useState<"LONG" | "SHORT">("LONG");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [targets, setTargets] = useState(["", ""]);
  // Controlled fields survive React's automatic form reset when the action returns an error.
  const [ticker, setTicker] = useState("");
  const [analysis, setAnalysis] = useState("");

  const e = Number(entry), s = Number(stop);
  const risk = entry && stop ? Math.abs(e - s) : 0;
  const long = direction === "LONG";
  const stopWrong = !!(entry && stop) && (long ? s >= e : s <= e);
  const rr = (t: string) => {
    if (!t || !risk || stopWrong) return null;
    const v = Number(t);
    if (!Number.isFinite(v) || (long ? v <= e : v >= e)) return "wrong side";
    return `${(Math.abs(v - e) / risk).toFixed(2)}R`;
  };

  return (
    <form action={action} className="form panel form-grid">
      <div className="field">
        <span>Direction</span>
        <div className="segmented" role="radiogroup">
          {(["LONG", "SHORT"] as const).map((d) => (
            <label key={d} className={direction === d ? `on ${d.toLowerCase()}` : ""}>
              <input type="radio" name="direction" value={d} checked={direction === d} onChange={() => setDirection(d)} />
              {d === "LONG" ? "▲ Long" : "▼ Short"}
            </label>
          ))}
        </div>
      </div>

      <label className="field">
        <span>Ticker</span>
        <input name="ticker" value={ticker} onChange={(ev) => setTicker(ev.target.value.toUpperCase())} required maxLength={12} placeholder="e.g. ORBX" className="upper" autoComplete="off" />
      </label>

      <label className="field">
        <span>Entry</span>
        <input name="entry" inputMode="decimal" required value={entry} onChange={(ev) => setEntry(ev.target.value)} placeholder="0.00" />
      </label>

      <label className="field">
        <span>Stop loss</span>
        <input name="stop" inputMode="decimal" required value={stop} onChange={(ev) => setStop(ev.target.value)} placeholder="0.00" />
        {stopWrong ? (
          <small className="error">Stop must be {long ? "below" : "above"} entry.</small>
        ) : risk > 0 ? (
          <small className="muted">
            Risk {risk.toFixed(2)} / share ({((risk / e) * 100).toFixed(1)}%)
          </small>
        ) : null}
      </label>

      <div className="field span-2">
        <span>Targets (nearest first)</span>
        <div className="targets">
          {targets.map((t, i) => (
            <div key={i} className="target-row">
              <span className="target-label">TP{i + 1}</span>
              <input
                name="target"
                inputMode="decimal"
                value={t}
                required={i === 0}
                placeholder="0.00"
                onChange={(ev) => setTargets(targets.map((x, j) => (j === i ? ev.target.value : x)))}
              />
              <span className={`rr ${rr(t) === "wrong side" ? "error" : ""}`}>{rr(t)}</span>
              {targets.length > 1 && (
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setTargets(targets.filter((_, j) => j !== i))} aria-label={`Remove TP${i + 1}`}>
                  ✕
                </button>
              )}
            </div>
          ))}
          {targets.length < 6 && (
            <button type="button" className="btn btn-sm btn-ghost add-target" onClick={() => setTargets([...targets, ""])}>
              + Add target
            </button>
          )}
        </div>
      </div>

      <label className="field span-2">
        <span>Analysis</span>
        <textarea name="analysis" value={analysis} onChange={(ev) => setAnalysis(ev.target.value)} required rows={7} placeholder="Pattern, context, trigger, invalidation…" />
      </label>

      <div className="field span-2">
        <span>Chart image</span>
        <ChartInput />
      </div>

      {state?.error && <p className="error span-2">{state.error}</p>}
      <div className="span-2 form-actions">
        <button className="btn btn-gold" disabled={pending}>
          {pending ? "Publishing…" : "Publish setup"}
        </button>
      </div>
    </form>
  );
}
