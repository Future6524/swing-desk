import { fmtDateTime, fmtPrice } from "@/lib/format";
import { CLOSE_REASON_LABEL, type Setup, type SetupEvent } from "@/lib/types";
import { RValue, StatusBadge } from "./ui";

function title(e: SetupEvent) {
  switch (e.kind) {
    case "CREATED":
      return "Setup published";
    case "STATUS":
      return "Triggered · In Play";
    case "TARGET_HIT":
      return `TP${e.target_index} hit`;
    case "STOP_ADJUSTED":
      return "Trailing stop adjusted";
    case "NOTE":
      return "Note";
    case "CLOSED":
      return `Closed · ${e.close_reason ? CLOSE_REASON_LABEL[e.close_reason] : ""}`;
  }
}

/** Full, newest-first history. Each entry is an immutable record as it was written. */
export function Timeline({ setup, events }: { setup: Setup; events: SetupEvent[] }) {
  const items = events.map((e, i) => ({ e, prevStop: i > 0 ? events[i - 1].stop_loss : null })).reverse();
  return (
    <ol className="timeline">
      {items.map(({ e, prevStop }) => {
        const stopMoved = prevStop != null && prevStop !== e.stop_loss;
        return (
          <li key={e.id} className={`tl-item tl-${e.kind.toLowerCase()}`}>
            <span className="tl-dot" aria-hidden />
            <div className="tl-card">
              <div className="tl-head">
                <span className="tl-title">{title(e)}</span>
                <StatusBadge status={e.status} />
                <span className="spacer" />
                <time dateTime={e.created_at} className="tl-time">
                  {fmtDateTime(e.created_at)}
                </time>
              </div>
              <div className="tl-facts">
                {e.kind === "CREATED" && (
                  <>
                    <Fact k="Entry" v={fmtPrice(setup.entry)} />
                    <Fact k="Stop" v={fmtPrice(e.stop_loss)} />
                    <Fact k="Targets" v={setup.targets.map(fmtPrice).join(" / ")} />
                  </>
                )}
                {e.kind === "STATUS" && <Fact k="Fill" v={fmtPrice(e.price)} />}
                {e.kind === "TARGET_HIT" && <Fact k="Price" v={fmtPrice(e.price)} />}
                {e.kind === "CLOSED" && e.price != null && <Fact k="Exit" v={fmtPrice(e.price)} />}
                {e.kind === "CLOSED" && (
                  <span className="fact">
                    <span className="fact-k">Result</span> <RValue r={e.r_multiple} />
                  </span>
                )}
                {stopMoved && (
                  <span className="fact">
                    <span className="fact-k">Stop</span>{" "}
                    <span className="mono">
                      <s className="muted">{fmtPrice(prevStop)}</s> → {fmtPrice(e.stop_loss)}
                    </span>
                  </span>
                )}
              </div>
              {e.note && <p className="tl-note">{e.note}</p>}
              {e.image_id && e.kind !== "CREATED" && (
                <a href={`/api/images/${e.image_id}`} target="_blank" rel="noreferrer" className="tl-image">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/images/${e.image_id}`} alt="Chart update" loading="lazy" />
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <span className="fact">
      <span className="fact-k">{k}</span> <span className="mono">{v}</span>
    </span>
  );
}
