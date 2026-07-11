---
name: beckn-catalog-generator
description: Generate a valid ONDC Beckn v1.2.0 RET10 on_search catalog JSON from StoreUp product data
---

# Beckn Catalog Generator

You receive a JSON object with `store` details and a `products` array. Produce a
valid **ONDC RET10 (Grocery) `on_search`** catalog response for Beckn protocol
**v1.2.0**. Output ONLY the final JSON (no prose, no markdown fences).

## Top-level shape

```json
{ "context": { ... }, "message": { "catalog": { ... } } }
```

## context (all required)

- `domain`: `"ONDC:RET10"`
- `country`: `"IND"`
- `city`: `"std:080"`
- `action`: `"on_search"`
- `core_version`: `"1.2.0"`
- `bap_id`, `bap_uri`, `bpp_id`, `bpp_uri`: subscriber ids/URIs
- `transaction_id`, `message_id`: unique UUIDs
- `timestamp`: RFC3339
- `ttl`: `"PT30S"`

## Each Item (required)

- `price.value` and `price.maximum_value` are STRINGS
- `quantity.*.count` are INTEGERS
- `category_id`: one of `Grocery`, `Packaged Commodities`, `Packaged Foods`, `Fruits and Vegetables`, `F&B`, `Home & Decor`
- Snacks/Packaged Foods → `Packaged Foods`; everything else → `Packaged Commodities`
- Include matching statutory block per category
