import { useEffect, useMemo, useState } from "react";
import { API_URL } from "../config.js";

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

// Mock ONDC buyer app. Reads the published store from the backend /catalog
// endpoint and lets a buyer "search" for products — the shopkeeper's store
// appears live with all items and prices.
export default function BuyerAppMock() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    let tries = 0;
    let timer = null;

    const load = async () => {
      try {
        const r = await fetch(`${API_URL}/catalog`);
        const d = await r.json();
        if (!active) return;
        setData(d);
        // Product images generate in the background; poll a few times so they
        // fill in if the buyer app was opened right after publishing.
        const stillWaiting = (d.products || []).some((p) => !p.image);
        tries += 1;
        if (stillWaiting && tries < 6) timer = setTimeout(load, 3000);
      } catch {
        if (active) setError("Couldn't reach the store network.");
      }
    };
    load();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const products = data?.products || [];
  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return products;
    const storeHit = (data?.store_name || "").toLowerCase().includes(q);
    return products.filter(
      (p) =>
        storeHit ||
        p.product_name.toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q)
    );
  }, [q, products, data]);

  const hasStore = data?.store_name && products.length > 0;

  return (
    <div className="app-shell buyer">
      <div className="buyer-top">
        <div className="buyer-brand">
          <span className="brand-dot" />
          <span>ONDC Shop</span>
          <span className="faint" style={{ fontWeight: 500, fontSize: 12 }}>
            buyer app
          </span>
        </div>
        <div className="search">
          <span>🔍</span>
          <input
            placeholder="Search products near you…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {!q && hasStore && (
          <div className="chip-row">
            {["Maggi", "Coke", "Milk", "Chips"].map((s) => (
              <button key={s} className="pill" onClick={() => setQuery(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="buyer-body">
        {error && <div className="empty">{error}</div>}

        {!error && !hasStore && (
          <div className="empty">
            <div style={{ fontSize: 30 }}>🏪</div>
            <div>No stores published yet.</div>
            <div className="faint" style={{ fontSize: 13 }}>
              Publish a store from StoreUp, then refresh.
            </div>
          </div>
        )}

        {!error && hasStore && (
          <>
            <div className="store-banner">
              <div className="store-logo">🏬</div>
              <div style={{ minWidth: 0 }}>
                <div className="h2">{data.store_name}</div>
                <div className="muted store-desc">{data.description}</div>
                <div className="store-tags">
                  <span className="tag ok">Open now</span>
                  <span className="tag">Free delivery</span>
                  {data.location && <span className="tag">{data.location}</span>}
                </div>
              </div>
            </div>

            <div className="sheet-head" style={{ padding: "4px 2px 8px" }}>
              <span className="h2" style={{ fontSize: 16 }}>
                {q ? `Results for “${query}”` : "All products"}
              </span>
              <span className="count-badge">{matches.length}</span>
            </div>

            {matches.length === 0 ? (
              <div className="empty">
                <div style={{ fontSize: 26 }}>🔎</div>
                <div>No products match “{query}”.</div>
              </div>
            ) : (
              <div className="buyer-grid">
                {matches.map((p, i) => (
                  <div className="buyer-card" key={`${p.product_name}-${i}`}>
                    <div className="buyer-thumb">
                      {p.image ? (
                        <img src={p.image} alt={p.product_name} />
                      ) : (
                        CATEGORY_EMOJI[p.category] || "🛒"
                      )}
                    </div>
                    <div className="buyer-name">{p.product_name}</div>
                    <div className="buyer-cat faint">{p.category}</div>
                    <div className="buyer-foot">
                      <span className="card-price">₹{p.price_inr}</span>
                      <button className="add-btn">Add</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
