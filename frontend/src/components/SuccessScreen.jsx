import { QRCodeSVG } from "qrcode.react";
import { API_URL } from "../config.js";

const CONFETTI = Array.from({ length: 40 });
const CONFETTI_COLORS = ["#c2683f", "#e0a458", "#5b7f56", "#ac592f", "#d8c3a5"];

export default function SuccessScreen({ result, onDone }) {
  const storeName = result?.store_name || "Your store";
  const count = result?.products?.length ?? 0;
  const source = result?.source;
  const valid = result?.valid;

  const buyerUrl = `${window.location.origin}/buyer`;
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(buyerUrl);

  return (
    <div className="success">
      <div className="confetti" aria-hidden="true">
        {CONFETTI.map((_, i) => (
          <span
            key={i}
            style={{
              left: `${(i * 97) % 100}%`,
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              animationDelay: `${(i % 10) * 0.18}s`,
              animationDuration: `${2.6 + (i % 5) * 0.35}s`,
            }}
          />
        ))}
      </div>

      <div className="success-body">
        <div className="success-badge">🎉</div>
        <h1 className="h1" style={{ marginTop: 18 }}>
          {storeName} is live on ONDC!
        </h1>
        <p className="muted" style={{ marginTop: 10, fontSize: 16 }}>
          {count} product{count === 1 ? "" : "s"} published. Buyers across
          India&rsquo;s ONDC network can now find your store.
        </p>

        <div className="success-meta">
          <span className="pill">Catalog: {valid ? "valid ✓" : "check"}</span>
          {source && <span className="pill">via {source.replace(/_/g, " ")}</span>}
        </div>

        <div className="qr-card">
          <div className="qr-frame">
            <QRCodeSVG value={buyerUrl} size={148} level="M" marginSize={0} />
          </div>
          <div className="qr-text">
            <div className="h2" style={{ fontSize: 16 }}>
              Scan to shop this store
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Open the live store in the ONDC buyer app on your phone.
            </div>
            {isLocalhost && (
              <div className="faint" style={{ fontSize: 11, marginTop: 6 }}>
                Tip: serve the app on your laptop&rsquo;s LAN IP so phones can
                scan this.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="success-actions">
        <a
          className="btn btn-primary btn-block"
          href={`${window.location.origin}/buyer`}
          target="_blank"
          rel="noreferrer"
        >
          See it in the buyer app
        </a>
        <button className="btn btn-ghost btn-block" onClick={onDone}>
          Done
        </button>
        <div className="faint" style={{ fontSize: 12, textAlign: "center" }}>
          Buyer data served from {API_URL.replace(/^https?:\/\//, "")}
        </div>
      </div>
    </div>
  );
}
