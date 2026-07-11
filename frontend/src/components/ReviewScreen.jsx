import { useEffect, useState } from "react";

const CATEGORY_EMOJI = {
  "Packaged Foods": "🍜",
  Snacks: "🍪",
  Beverages: "🥤",
  Dairy: "🥛",
  "Personal Care": "🧴",
  Household: "🧹",
  Staples: "🌾",
  Frozen: "🧊",
  "Baby Care": "🍼",
  "Pet Care": "🐾",
  Other: "🛒",
};

export default function ReviewScreen({
  products,
  onClose,
  onRemove,
  onUpdate,
  onPublish,
  errorMsg,
}) {
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (errorMsg) setPublishing(false);
  }, [errorMsg]);

  const handlePublish = () => {
    setPublishing(true);
    onPublish();
  };

  return (
    <div className="modal">
      <div className="modal-sheet">
        <div className="modal-head">
          <div>
            <div className="h2">Review your store</div>
            <div className="faint" style={{ fontSize: 13, marginTop: 2 }}>
              Fix prices, quantities, or remove anything before publishing.
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="review-list">
          {products.map((p) => (
            <div className="review-row" key={p.product_name}>
              <div className="card-emoji">
                {CATEGORY_EMOJI[p.category] || "🛒"}
              </div>
              <div className="review-main">
                <div className="card-name">{p.product_name}</div>
                <div className="review-edits">
                  <label className="edit-field">
                    <span>₹</span>
                    <input
                      type="number"
                      min="0"
                      defaultValue={p.price_inr}
                      onBlur={(e) =>
                        onUpdate(p.product_name, {
                          price_inr: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="edit-field">
                    <span>×</span>
                    <input
                      type="number"
                      min="0"
                      defaultValue={p.quantity}
                      onBlur={(e) =>
                        onUpdate(p.product_name, {
                          quantity: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>
              </div>
              <button
                className="icon-btn danger"
                onClick={() => onRemove(p.product_name)}
                aria-label={`Remove ${p.product_name}`}
              >
                🗑
              </button>
            </div>
          ))}
        </div>

        <div className="action-bar">
          <button className="btn btn-ghost" onClick={onClose}>
            Back
          </button>
          <button
            className="btn btn-primary btn-block"
            disabled={products.length === 0 || publishing}
            onClick={handlePublish}
          >
            {publishing ? "Publishing…" : "Publish to ONDC"}
          </button>
        </div>
      </div>

      {publishing && (
        <div className="publish-overlay">
          <div className="spinner" />
          <div className="h2" style={{ marginTop: 14 }}>
            Publishing your store…
          </div>
          <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
            Building your ONDC catalog.
          </div>
        </div>
      )}
    </div>
  );
}
