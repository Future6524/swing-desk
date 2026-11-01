"use client";

import { useActionState, useState } from "react";
import { ChartInput } from "@/components/ChartInput";
import type { Direction, EventKind, Status } from "@/lib/types";
import { appendEventAction } from "../../actions";

interface Props {
  setupId: number;
  status: Status;
  direction: Direction;
  entry: number;
  currentStop: number;
  nextTarget: { index: number; price: number } | null;
}

export function EventForm({ setupId, status, direction, entry, currentStop, nextTarget }: Props) {
  const [state, action, pending] = useActionState(appendEventAction, undefined);

  const options: { kind: EventKind; label: string }[] =
    status === "CLOSED"
      ? [{ kind: "NOTE", label: "Post-trade note" }]
      : status === "WATCHING"
        ? [
            { kind: "STATUS", label: "Triggered → In Play" },
            { kind: "STOP_ADJUSTED", label: "Adjust stop" },
            { kind: "NOTE", label: "Note" },
            { kind: "CLOSED", label: "Invalidate" },
          ]
        : [
            ...(nextTarget ? [{ kind: "TARGET_HIT" as const, label: `TP${nextTarget.index} hit` }] : []),
            { kind: "STOP_ADJUSTED", label: "Trail stop" },
            { kind: "NOTE", label: "Note" },
            { kind: "CLOSED", label: "Close trade" },
          ];

  const [kind, setKind] = useState<EventKind>(options[0].kind);
  const [reason, setReason] = useState(status === "WATCHING" ? "INVALIDATED" : "STOPPED");
  const [note, setNote] = useState("");
  const tighten = direction === "LONG" ? "above" : "below";

  return (
    <form action={action} className="form">
      <input type="hidden" name="setupId" value={setupId} />
      <input type="hidden" name="kind" value={kind} />
      <div className="kind-tabs" role="tablist">
        {options.map((o) => (
          <button
            key={o.kind}
            type="button"
            role="tab"
            aria-selected={kind === o.kind}
            className={kind === o.kind ? "on" : ""}
            onClick={() => setKind(o.kind)}
          >
            {o.label}
          </button>
        ))}
      </div>

      {kind === "STATUS" && (
        <label className="field">
          <span>Fill price</span>
          <input name="price" inputMode="decimal" placeholder={entry.toFixed(2)} />
          <small className="muted">Leave blank to record a fill at the planned entry.</small>
        </label>
      )}

      {kind === "TARGET_HIT" && nextTarget && (
        <>
          <label className="field">
            <span>TP{nextTarget.index} price</span>
            <input name="price" inputMode="decimal" placeholder={nextTarget.price.toFixed(2)} />
          </label>
          <label className="field">
            <span>Move stop to (optional)</span>
            <input name="stop" inputMode="decimal" placeholder={`e.g. ${entry.toFixed(2)} (breakeven)`} />
            <small className="muted">Must be {tighten} the current stop of {currentStop.toFixed(2)}.</small>
          </label>
        </>
      )}

      {kind === "STOP_ADJUSTED" && (
        <label className="field">
          <span>New stop</span>
          <input name="stop" inputMode="decimal" required placeholder={currentStop.toFixed(2)} />
          <small className="muted">
            {status === "WATCHING"
              ? `Must stay ${direction === "LONG" ? "below" : "above"} entry.`
              : `Trailing only: must be ${tighten} the current stop of ${currentStop.toFixed(2)}.`}
          </small>
        </label>
      )}

      {kind === "CLOSED" && (
        <>
          {status === "WATCHING" ? (
            <input type="hidden" name="reason" value="INVALIDATED" />
          ) : (
            <>
              <label className="field">
                <span>Reason</span>
                <select name="reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                  <option value="STOPPED">Stopped out</option>
                  <option value="TARGET">Final target</option>
                  <option value="MANUAL">Manual exit</option>
                </select>
              </label>
              <label className="field">
                <span>Exit price</span>
                <input
                  name="price"
                  inputMode="decimal"
                  required={reason !== "STOPPED"}
                  placeholder={reason === "STOPPED" ? currentStop.toFixed(2) : "0.00"}
                />
                {reason === "STOPPED" && <small className="muted">Blank = filled at the current stop.</small>}
              </label>
            </>
          )}
        </>
      )}

      <label className="field">
        <span>{kind === "NOTE" ? "Note" : "Note (optional)"}</span>
        <textarea name="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      <div className="field">
        <span>Chart update (optional)</span>
        <ChartInput key={kind} />
      </div>

      {state?.error && <p className="error">{state.error}</p>}
      <button className="btn btn-gold" disabled={pending}>
        {pending ? "Recording…" : "Append to history"}
      </button>
      <small className="muted">Entries are permanent and timestamped. They cannot be edited or deleted.</small>
    </form>
  );
}
