import { useEffect, useMemo, useState } from "react";
import { API_URL } from "../config.js";

export default function BuyerAppMock() {
  const [catalog, setCatalog] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchCatalog() {
      try {
        const response = await fetch(`${API_URL}/catalog`);
        const json = await response.json();

        if (!mounted) return;

        setCatalog(json);
        setLoading(false);
      } catch {
        if (!mounted) return;

        setError("Unable to load catalog.");
        setLoading(false);
      }
    }

    fetchCatalog();

    return () => {
      mounted = false;
    };
  }, []);

  const products = catalog?.products ?? [];

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;

    const keyword = search.toLowerCase().trim();

    return products.filter((item) => {
      return [
        item.product_name,
        item.category,
        item.brand,
        item.description,
      ]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(keyword));
    });
  }, [products, search]);

  const hasProducts =
    catalog?.store_name && products.length > 0;

  return (
    <div className="catalog-page">
      <header className="catalog-header">
        <div className="brand-section">
          <h2>ONDC Shop</h2>
          <span>Buyer Portal</span>
        </div>

        <div className="search-box">
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      <main className="catalog-content">
        {loading && (
          <div className="status-message">
            Loading catalog...
          </div>
        )}

        {!loading && error && (
          <div className="status-message">
            {error}
          </div>
        )}

        {!loading && !error && !hasProducts && (
          <div className="status-message">
            <h3>No Store Available</h3>
            <p>
              Publish a store from StoreUp to view products.
            </p>
          </div>
        )}

        {!loading && !error && hasProducts && (
          <>
            <section className="store-header">
              <div className="store-image" />

              <div className="store-details">
                <h2>{catalog.store_name}</h2>

                {catalog.description && (
                  <p>{catalog.description}</p>
                )}

                <div className="store-info">
                  <span>Open</span>

                  {catalog.location && (
                    <span>{catalog.location}</span>
                  )}
                </div>
              </div>
            </section>

            <section className="results-header">
              <h3>
                {search
                  ? `Search Results (${filteredProducts.length})`
                  : `Products (${products.length})`}
              </h3>
            </section>

            {filteredProducts.length === 0 ? (
              <div className="status-message">
                No matching products found.
              </div>
            ) : (
              <section className="products-grid">
                {filteredProducts.map((product, index) => (
                  <article
                    className="product-card"
                    key={product.id ?? index}
                  >
                    <div className="product-image">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.product_name}
                        />
                      ) : (
                        <div className="image-placeholder">
                          No Image
                        </div>
                      )}
                    </div>

                    <div className="product-content">
                      <h4>{product.product_name}</h4>

                      <p className="category">
                        {product.category}
                      </p>

                      <div className="product-footer">
                        <span className="price">
                          ₹{product.price_inr}
                        </span>

                        <button type="button">
                          Add to Cart
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}