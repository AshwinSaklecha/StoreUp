import ProductCard from "./ProductCard.jsx";
import AudioWaveform from "./AudioWaveform.jsx";

const STATUS_LABEL = {
  idle: "Connecting…",
  connecting: "Connecting…",
  live: "Listening",
  error: "Offline",
};

export default function ScanningScreen({
  camera,
  live,
  micOn,
  onToggleMic,
  onExit,
  onReview,
}) {
  const status = camera.error ? "error" : live.status;
  const isLive = status === "live";
  const products = live.products;

  return (
    <div className="scan">
      <div className="scan-top">
        <video ref={camera.videoRef} className="scan-video" playsInline muted />
        <div className="scan-overlay">
          <div className="topbar">
            <span
              className={`chip ${
                status === "error" ? "err" : isLive && micOn ? "live" : ""
              }`}
            >
              <span className="dot" />
              {status === "error" ? (
                STATUS_LABEL[status]
              ) : !isLive ? (
                STATUS_LABEL[status] || "Connecting…"
              ) : micOn ? (
                <>
                  <AudioWaveform /> {STATUS_LABEL.live}
                </>
              ) : (
                "Mic muted"
              )}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className={`chip ${micOn ? "" : "err"}`}
                style={{ pointerEvents: "auto", cursor: "pointer" }}
                onClick={onToggleMic}
                aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
              >
                {micOn ? "🎙 Mic on" : "🔇 Mic off"}
              </button>
              <button
                className="chip"
                style={{ pointerEvents: "auto", cursor: "pointer" }}
                onClick={onExit}
              >
                Close
              </button>
            </div>
          </div>

          {live.caption ? (
            <div className="caption">{live.caption}</div>
          ) : (
            <span />
          )}
        </div>
      </div>

      <div className="scan-bottom">
        <div className="sheet-head">
          <span className="h2">Your products</span>
          <span className="count-badge">{products.length} added</span>
        </div>

        {products.length === 0 ? (
          <div className="empty">
            <div style={{ fontSize: 30 }}>🛒</div>
            <div>Point your camera at a product and start talking.</div>
            <div className="faint" style={{ fontSize: 13 }}>
              Products you confirm will appear here.
            </div>
          </div>
        ) : (
          <div className="product-list">
            {products.map((p, i) => (
              <ProductCard product={p} key={`${p.product_name}-${i}`} />
            ))}
          </div>
        )}

        <div className="action-bar">
          <button className="btn btn-ghost" onClick={onExit}>
            Cancel
          </button>
          <button
            className="btn btn-primary btn-block"
            disabled={products.length === 0}
            onClick={onReview}
          >
            Review &amp; publish
          </button>
        </div>
      </div>

      {live.errorMsg && status === "error" && (
        <div
          className="caption"
          style={{
            position: "absolute",
            bottom: 90,
            left: 16,
            right: 16,
            background: "rgba(176,82,46,0.92)",
          }}
        >
          {live.errorMsg}
        </div>
      )}
    </div>
  );
}
