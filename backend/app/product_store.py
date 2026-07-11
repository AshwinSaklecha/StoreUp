"""In-memory product database for a single StoreUp onboarding session."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Optional

VALID_CATEGORIES = {
    "Packaged Foods",
    "Beverages",
    "Personal Care",
    "Household",
    "Dairy",
    "Snacks",
    "Staples",
    "Frozen",
    "Baby Care",
    "Pet Care",
    "Other",
}


@dataclass
class Product:
    product_name: str
    price_inr: float
    quantity: int
    category: str
    image: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class StoreState:
    products: list[Product] = field(default_factory=list)
    store_name: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    gps: Optional[str] = None
    published: bool = False
    catalog: Optional[dict] = None
    catalog_source: Optional[str] = None
    catalog_valid: Optional[bool] = None


class ProductStore:
    """Single-session inventory with case-insensitive de-duplication."""

    def __init__(self) -> None:
        self.state = StoreState()

    def _find(self, name: str) -> Optional[Product]:
        needle = name.strip().lower()
        for p in self.state.products:
            if p.product_name.strip().lower() == needle:
                return p
        return None

    def add_product(self, product_name: str, price_inr: float, quantity: int, category: str) -> dict:
        category = category if category in VALID_CATEGORIES else "Other"
        existing = self._find(product_name)
        if existing is not None:
            existing.price_inr = price_inr
            existing.quantity = quantity
            existing.category = category
            return {"status": "updated", "product": existing.to_dict(), "total_products": len(self.state.products)}
        product = Product(product_name=product_name.strip(), price_inr=price_inr, quantity=quantity, category=category)
        self.state.products.append(product)
        return {"status": "added", "product": product.to_dict(), "total_products": len(self.state.products)}

    def list_products(self) -> list[dict]:
        return [p.to_dict() for p in self.state.products]

    def set_image(self, product_name: str, image: str) -> bool:
        existing = self._find(product_name)
        if existing is None:
            return False
        existing.image = image
        return True

    def remove_product(self, product_name: str) -> dict:
        existing = self._find(product_name)
        if existing is None:
            return {"status": "not_found", "total_products": len(self.state.products)}
        self.state.products.remove(existing)
        return {"status": "removed", "product_name": existing.product_name, "total_products": len(self.state.products)}

    def update_product(self, product_name: str, price_inr: Optional[float] = None, quantity: Optional[int] = None) -> dict:
        existing = self._find(product_name)
        if existing is None:
            return {"status": "not_found"}
        if price_inr is not None:
            existing.price_inr = price_inr
        if quantity is not None:
            existing.quantity = quantity
        return {"status": "updated", "product": existing.to_dict()}

    def set_description(self, store_name: str, location: Optional[str] = None, description: Optional[str] = None) -> dict:
        self.state.store_name = store_name
        if location:
            self.state.location = location
        self.state.description = description or self._synthesize_description(store_name, location)
        return {"status": "ok", "store_name": self.state.store_name, "location": self.state.location, "description": self.state.description}

    def _synthesize_description(self, store_name: str, location: Optional[str]) -> str:
        categories = []
        for p in self.state.products:
            if p.category not in categories:
                categories.append(p.category)
        if categories:
            cats = categories[:-1]
            joined = (", ".join(cats) + f" and {categories[-1]}" if len(categories) > 1 else categories[0])
            offering = joined.lower()
        else:
            offering = "daily essentials"
        where = f" in {location}" if location else ""
        return f"{store_name} - {offering}{where}."

    def publish(self, store_name: str, gps: Optional[str] = None) -> dict:
        self.state.store_name = store_name
        if gps:
            self.state.gps = gps
        self.state.published = True
        return {"status": "published", "store_name": self.state.store_name, "description": self.state.description, "total_products": len(self.state.products), "products": self.list_products()}

    def set_catalog(self, catalog: dict, *, source: str, valid: bool) -> None:
        self.state.catalog = catalog
        self.state.catalog_source = source
        self.state.catalog_valid = valid

    def reset(self) -> None:
        self.state = StoreState()


store = ProductStore()
