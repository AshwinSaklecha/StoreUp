"""Deterministic ONDC Beckn v1.2.0 on_search catalog builder + validator."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any

from . import config
from .product_store import StoreState

_ONDC_ITEM_CATEGORIES = {
    "Grocery", "Packaged Commodities", "Packaged Foods",
    "Fruits and Vegetables", "F&B", "Home & Decor",
}

_CATEGORY_MAP = {
    "Packaged Foods": "Packaged Foods",
    "Snacks": "Packaged Foods",
    "Dairy": "Packaged Commodities",
    "Beverages": "Packaged Commodities",
    "Personal Care": "Packaged Commodities",
    "Household": "Packaged Commodities",
    "Staples": "Packaged Commodities",
    "Frozen": "Packaged Commodities",
    "Baby Care": "Packaged Commodities",
    "Pet Care": "Packaged Commodities",
    "Other": "Packaged Commodities",
}

_DECIMAL_RE = re.compile(r"^[+-]?([0-9]*[.])?[0-9]+$")
_PLACEHOLDER_IMAGE = "https://storeup.in/assets/product-placeholder.png"

MOCK_FIELDS = [
    "context.bap_id / bpp_id — network identity (needs real ONDC registration)",
    "provider.@ondc/org/fssai_license_no — placeholder license",
    "item.descriptor.images / symbol — placeholder image",
    "item.descriptor.code — pseudo EAN/barcode",
    "item.@ondc/org/statutory_reqs_* — label text ('as printed on pack')",
    "provider.locations[].address (street/area_code) — approximate",
    "provider.gps — default coordinate",
]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _money(value: float) -> str:
    return f"{float(value):.2f}"


def _ondc_category(internal_category: str) -> str:
    return _CATEGORY_MAP.get(internal_category, "Packaged Commodities")


def _statutory_block(ondc_category: str, store_name: str, net_qty: str) -> dict:
    if ondc_category == "Packaged Foods":
        return {
            "@ondc/org/statutory_reqs_prepackaged_food": {
                "nutritional_info": "As printed on pack",
                "additives_info": "As printed on pack",
                "brand_owner_name": store_name,
                "net_quantity": net_qty,
            }
        }
    return {
        "@ondc/org/statutory_reqs_packaged_commodities": {
            "manufacturer_or_packer_name": store_name,
            "manufacturer_or_packer_address": "As printed on pack",
            "common_or_generic_name_of_commodity": "As printed on pack",
            "net_quantity_or_measure_of_commodity_in_pkg": net_qty,
            "month_year_of_manufacture_packing_import": datetime.now(timezone.utc).strftime("%m/%Y"),
        }
    }


def _pseudo_ean(name: str) -> str:
    digits = str(abs(hash(name)))[:12].ljust(12, "0")
    return "890" + digits[:10]


def _build_item(index: int, product: dict, store_name: str) -> dict:
    ondc_category = _ondc_category(product.get("category", "Other"))
    price = _money(product.get("price_inr", 0))
    qty = int(product.get("quantity", 0) or 0)
    name = product.get("product_name", f"Item {index + 1}")
    net_qty = "1 unit"

    item: dict[str, Any] = {
        "id": f"I{index + 1}",
        "descriptor": {
            "name": name,
            "symbol": _PLACEHOLDER_IMAGE,
            "short_desc": name,
            "long_desc": f"{name} available at {store_name}.",
            "images": [_PLACEHOLDER_IMAGE],
            "code": f"1:{_pseudo_ean(name)}",
        },
        "quantity": {
            "unitized": {"measure": {"unit": "unit", "value": "1"}},
            "available": {"count": qty},
            "maximum": {"count": max(qty, 1)},
        },
        "price": {"currency": config.ONDC_CURRENCY, "value": price, "maximum_value": price},
        "category_id": ondc_category,
        "fulfillment_id": "F1",
        "location_id": "L1",
        "matched": True,
        "@ondc/org/returnable": False,
        "@ondc/org/cancellable": True,
        "@ondc/org/return_window": "P0D",
        "@ondc/org/seller_pickup_return": False,
        "@ondc/org/time_to_ship": "PT45M",
        "@ondc/org/available_on_cod": True,
        "@ondc/org/contact_details_consumer_care": "StoreUp Support, support@storeup.in, 1800-000-0000",
    }
    item.update(_statutory_block(ondc_category, store_name, net_qty))
    return item


def build_catalog(state: StoreState) -> dict:
    store_name = state.store_name or "StoreUp Store"
    description = state.description or f"{store_name} - daily essentials."
    long_description = f"{description} Order online with fast local delivery from your neighbourhood store on ONDC."
    gps = state.gps or config.DEFAULT_GPS
    now = _now_iso()

    context = {
        "domain": config.ONDC_DOMAIN, "country": config.ONDC_COUNTRY,
        "city": config.ONDC_CITY_CODE, "action": "on_search",
        "core_version": config.ONDC_CORE_VERSION,
        "bap_id": config.BAP_ID, "bap_uri": config.BAP_URI,
        "bpp_id": config.BPP_ID, "bpp_uri": config.BPP_URI,
        "transaction_id": str(uuid.uuid4()), "message_id": str(uuid.uuid4()),
        "timestamp": now, "ttl": "PT30S",
    }

    fulfillments = [{"id": "F1", "type": "Delivery"}]
    location = {
        "id": "L1", "gps": gps,
        "address": {"locality": state.location or "Main Road", "street": "Shop Street", "city": "Bengaluru", "area_code": "560001", "state": "KA"},
        "time": {"label": "enable", "timestamp": now, "days": "1,2,3,4,5,6,7", "schedule": {"holidays": []}, "range": {"start": "0800", "end": "2200"}},
    }

    items = [_build_item(i, p.to_dict(), store_name) for i, p in enumerate(state.products)]
    provider = {
        "id": "P1",
        "time": {"label": "enable", "timestamp": now},
        "ttl": "P1D",
        "descriptor": {"name": store_name, "symbol": _PLACEHOLDER_IMAGE, "short_desc": description, "long_desc": long_description, "images": [_PLACEHOLDER_IMAGE]},
        "@ondc/org/fssai_license_no": "12345678901234",
        "locations": [location],
        "fulfillments": fulfillments,
        "categories": _provider_categories(items),
        "items": items,
    }

    return {
        "context": context,
        "message": {"catalog": {"bpp/descriptor": {"name": store_name, "symbol": _PLACEHOLDER_IMAGE, "short_desc": description, "long_desc": long_description, "images": [_PLACEHOLDER_IMAGE]}, "bpp/fulfillments": fulfillments, "bpp/providers": [provider]}},
    }


def _provider_categories(items: list[dict]) -> list[dict]:
    seen = []
    for it in items:
        cid = it["category_id"]
        if cid not in seen:
            seen.append(cid)
    return [{"id": cid, "descriptor": {"name": cid}} for cid in seen]


_REQUIRED_CONTEXT = {"domain", "action", "core_version", "bap_id", "bap_uri", "transaction_id", "message_id", "city", "country", "timestamp"}
_REQUIRED_DESCRIPTOR = {"name", "symbol", "short_desc", "long_desc", "images"}
_ITEM_ONDC_FIELDS = {"@ondc/org/returnable", "@ondc/org/cancellable", "@ondc/org/return_window", "@ondc/org/seller_pickup_return", "@ondc/org/time_to_ship", "@ondc/org/available_on_cod", "@ondc/org/contact_details_consumer_care"}


def validate_catalog(catalog: dict) -> tuple[bool, list[str]]:
    errors: list[str] = []
    if not isinstance(catalog, dict):
        return False, ["catalog is not a JSON object"]
    ctx = catalog.get("context")
    if not isinstance(ctx, dict):
        errors.append("missing context object")
    else:
        for k in _REQUIRED_CONTEXT:
            if k not in ctx:
                errors.append(f"context missing '{k}'")
        if ctx.get("domain") != config.ONDC_DOMAIN:
            errors.append(f"context.domain must be '{config.ONDC_DOMAIN}'")
        if ctx.get("action") != "on_search":
            errors.append("context.action must be 'on_search'")
        if str(ctx.get("core_version")) != config.ONDC_CORE_VERSION:
            errors.append(f"context.core_version must be '{config.ONDC_CORE_VERSION}'")
    catalog_body = (catalog.get("message") or {}).get("catalog")
    if not isinstance(catalog_body, dict):
        return False, errors + ["missing message.catalog"]
    _check_descriptor(catalog_body.get("bpp/descriptor"), "bpp/descriptor", errors)
    providers = catalog_body.get("bpp/providers")
    if not isinstance(providers, list) or not providers:
        return False, errors + ["bpp/providers must be a non-empty array"]
    for pi, provider in enumerate(providers):
        _validate_provider(pi, provider, errors)
    return (len(errors) == 0), errors


def _check_descriptor(desc: Any, where: str, errors: list[str]) -> None:
    if not isinstance(desc, dict):
        errors.append(f"{where} missing or not an object")
        return
    for k in _REQUIRED_DESCRIPTOR:
        if k not in desc or desc[k] in (None, "", []):
            errors.append(f"{where} missing '{k}'")


def _validate_provider(pi: int, provider: dict, errors: list[str]) -> None:
    tag = f"providers[{pi}]"
    if not isinstance(provider, dict):
        errors.append(f"{tag} is not an object")
        return
    for k in ("id", "ttl", "@ondc/org/fssai_license_no"):
        if not provider.get(k):
            errors.append(f"{tag} missing '{k}'")
    _check_descriptor(provider.get("descriptor"), f"{tag}.descriptor", errors)
    location_ids = set()
    locations = provider.get("locations")
    if not isinstance(locations, list) or not locations:
        errors.append(f"{tag}.locations must be a non-empty array")
    else:
        for li, loc in enumerate(locations):
            ltag = f"{tag}.locations[{li}]"
            if not loc.get("id"):
                errors.append(f"{ltag} missing 'id'")
            else:
                location_ids.add(loc["id"])
            if not loc.get("gps"):
                errors.append(f"{ltag} missing 'gps'")
            addr = loc.get("address") or {}
            for ak in ("street", "city", "area_code", "state"):
                if not addr.get(ak):
                    errors.append(f"{ltag}.address missing '{ak}'")
            time_obj = loc.get("time") or {}
            for tk in ("label", "timestamp"):
                if not time_obj.get(tk):
                    errors.append(f"{ltag}.time missing '{tk}'")
    fulfillment_ids = set()
    fulfillments = provider.get("fulfillments")
    if not isinstance(fulfillments, list) or not fulfillments:
        errors.append(f"{tag}.fulfillments must be a non-empty array")
    else:
        for fi, ful in enumerate(fulfillments):
            if not ful.get("id"):
                errors.append(f"{tag}.fulfillments[{fi}] missing 'id'")
            else:
                fulfillment_ids.add(ful["id"])
            if not ful.get("type"):
                errors.append(f"{tag}.fulfillments[{fi}] missing 'type'")
    items = provider.get("items")
    if not isinstance(items, list) or not items:
        errors.append(f"{tag}.items must be a non-empty array")
        return
    seen_ids: set = set()
    for ii, item in enumerate(items):
        _validate_item(f"{tag}.items[{ii}]", item, errors, location_ids, fulfillment_ids, seen_ids)


def _validate_item(tag: str, item: dict, errors: list[str], location_ids: set, fulfillment_ids: set, seen_ids: set) -> None:
    if not isinstance(item, dict):
        errors.append(f"{tag} is not an object")
        return
    item_id = item.get("id")
    if not item_id:
        errors.append(f"{tag} missing 'id'")
    elif item_id in seen_ids:
        errors.append(f"{tag} duplicate item id '{item_id}'")
    else:
        seen_ids.add(item_id)
    desc = item.get("descriptor") or {}
    _check_descriptor(desc, f"{tag}.descriptor", errors)
    if desc.get("short_desc") and desc.get("short_desc") == desc.get("long_desc"):
        errors.append(f"{tag}.descriptor short_desc and long_desc must differ")
    price = item.get("price") or {}
    if price.get("currency") != config.ONDC_CURRENCY:
        errors.append(f"{tag}.price.currency must be '{config.ONDC_CURRENCY}'")
    for pk in ("value", "maximum_value"):
        pv = price.get(pk)
        if not isinstance(pv, str):
            errors.append(f"{tag}.price.{pk} must be a string")
        elif pv != pv.strip() or not _DECIMAL_RE.match(pv):
            errors.append(f"{tag}.price.{pk} '{pv}' is not a valid DecimalValue")
    qty = item.get("quantity") or {}
    avail = (qty.get("available") or {}).get("count")
    if not isinstance(avail, int) or isinstance(avail, bool) or avail < 0:
        errors.append(f"{tag}.quantity.available.count must be an integer >= 0")
    cat = item.get("category_id")
    if cat not in _ONDC_ITEM_CATEGORIES:
        errors.append(f"{tag}.category_id '{cat}' is not a valid ONDC category")
    if item.get("fulfillment_id") not in fulfillment_ids:
        errors.append(f"{tag}.fulfillment_id does not resolve")
    if item.get("location_id") not in location_ids:
        errors.append(f"{tag}.location_id does not resolve")
    if not isinstance(item.get("matched"), bool):
        errors.append(f"{tag}.matched must be a boolean")
    for k in _ITEM_ONDC_FIELDS:
        if k not in item:
            errors.append(f"{tag} missing '{k}'")
    if cat == "Packaged Foods":
        if "@ondc/org/statutory_reqs_prepackaged_food" not in item:
            errors.append(f"{tag} missing '@ondc/org/statutory_reqs_prepackaged_food'")
    elif cat in ("Packaged Commodities", "Grocery"):
        if "@ondc/org/statutory_reqs_packaged_commodities" not in item:
            errors.append(f"{tag} missing '@ondc/org/statutory_reqs_packaged_commodities'")
