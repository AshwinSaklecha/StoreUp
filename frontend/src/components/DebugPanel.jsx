import { useMemo, useState } from "react";

const DEFAULT_MOCK = [
  "Network IDs (bap_id / bpp_id) — needs ONDC registration",
  "FSSAI license — placeholder",
  "Product images / EAN — placeholder",
  "Street / pincode — approximate",
  "GPS — default coordinate",
];

export default function DebugPanel({ live, debugMode }) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState("events");

  const events = live.debugEvents || [];
  const published = live.publishResult;

  const transcripts = useMemo(
    () => events.filter((e) => e.kind === "transcript"),
    [events]
  );
  const calls = useMemo(
    () => events.filter((e) => e.kind === "function_call"),
    [events]
  );

  if (!debugMode) return null;

  return (
    <aside className={`debug-panel ${open ? "open" : "collapsed"}`}>
      <div className="debug-head">
        <div>
          <div className="debug-title">Debug</div>
          <div className="faint" style={{ fontSize: 12 }}>
            ?debug=1 — for judges
          </div>
        </div>
        <button className="icon-btn" onClick={() => setOpen((v) => !v)}>
          {open ? "−" : "+"}
        </button>
      </div>

      {open && (
        <>
          <div className="debug-status">
            <span className={`tag ${live.status === "live" ? "ok" : ""}`}>
              WS: {live.status}
            </span>
            <span className="tag">{live.products.length} products</span>
            {published?.valid != null && (
              <span className={`tag ${published.valid ? "ok" : ""}`}>
                catalog {published.valid ? "valid" : "invalid"}
              </span>
            )}
            {published?.source && (
              <span className="tag">via {published.source.replace(/_/g, " ")}</span>
            )}
          </div>

          <div className="debug-tabs">
            {[
              ["events", "Live"],
              ["beckn", "Beckn JSON"],
              ["mock", "Mock fields"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={`debug-tab ${tab === id ? "active" : ""}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="debug-body">
            {tab === "events" && (
              <>
                <section className="debug-section">
                  <div className="debug-label">Transcripts</div>
                  {transcripts.length === 0 ? (
                    <div className="debug-empty">Waiting for speech…</div>
                  ) : (
                    transcripts.map((e, i) => (
                      <div className="debug-line" key={`t-${i}`}>
                        <span className="debug-ts">{e.time}</span>
                        <span className="debug-role">{e.role}</span>
                        <span>{e.text}</span>
                      </div>
                    ))
                  )}
                </section>

                <section className="debug-section">
                  <div className="debug-label">Function calls</div>
                  {calls.length === 0 ? (
                    <div className="debug-empty">None yet</div>
                  ) : (
                    calls.map((e, i) => (
                      <div className="debug-call" key={`f-${i}`}>
                        <div className="debug-call-head">
                          <span className="debug-ts">{e.time}</span>
                          <code>{e.name}</code>
                          <span className="tag ok">{e.result?.status}</span>
                        </div>
                        <pre>{JSON.stringify(e.args, null, 2)}</pre>
                      </div>
                    ))
                  )}
                </section>

                <section className="debug-section">
                  <div className="debug-label">Event log</div>
                  {events.length === 0 ? (
                    <div className="debug-empty">No events</div>
                  ) : (
                    events
                      .slice()
                      .reverse()
                      .slice(0, 40)
                      .map((e, i) => (
                        <div className="debug-line faint" key={`e-${i}`}>
                          <span className="debug-ts">{e.time}</span>
                          <span>{e.kind}</span>
                          {e.detail && <span> — {e.detail}</span>}
                        </div>
                      ))
                  )}
                </section>
              </>
            )}

            {tab === "beckn" && (
              <section className="debug-section">
                {!published?.catalog ? (
                  <div className="debug-empty">
                    Publish a store to see the generated ONDC Beckn catalog.
                  </div>
                ) : (
                  <>
                    <div className="debug-label">
                      Validation: {published.valid ? "passed" : "failed"}
                    </div>
                    <pre className="debug-json">
                      {JSON.stringify(published.catalog, null, 2)}
                    </pre>
                  </>
                )}
              </section>
            )}

            {tab === "mock" && (
              <section className="debug-section">
                <div className="debug-label">Real vs mock</div>
                <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
                  Product name, price, quantity, category, store name, and area
                  are captured live by voice. These fields are intentional
                  placeholders:
                </p>
                <ul className="mock-list">
                  {(published?.mock_fields || DEFAULT_MOCK).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
