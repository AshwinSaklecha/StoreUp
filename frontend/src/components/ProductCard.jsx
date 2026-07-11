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

export default function ProductCard({ product }) {
  const emoji = CATEGORY_EMOJI[product.category] || "🛒";
  const price = Number(product.price_inr);
  return (
    <div className="card">
      <div className="card-emoji">{emoji}</div>
      <div className="card-main">
        <div className="card-name">{product.product_name}</div>
        <div className="card-sub">{product.category}</div>
      </div>
      <div>
        <div className="card-price">
          ₹{Number.isFinite(price) ? price : product.price_inr}
        </div>
        <div className="card-qty">Qty: {product.quantity}</div>
      </div>
    </div>
  );
}
