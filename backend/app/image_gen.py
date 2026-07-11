"""Nano Banana 2 Lite product-image generation (buyer-app polish).

Generates a clean e-commerce product photo per product, in the background, and
caches it. Any failure returns None — buyer app falls back to a category emoji.
"""

from __future__ import annotations

import base64
from typing import Optional

from google.genai import types

from . import config

_cache: dict[str, Optional[str]] = {}


def _prompt_for(product_name: str) -> str:
    return (
        f"A clean, professional e-commerce product photo of '{product_name}'. "
        "Single product, centered, on a plain white background, soft studio "
        "lighting, sharp focus, realistic packaging. No text overlays, no "
        "watermark, no people, no hands."
    )


def _extract_data_url(response) -> Optional[str]:
    parts = None
    try:
        parts = response.candidates[0].content.parts
    except (AttributeError, IndexError, TypeError):
        parts = getattr(response, "parts", None)
    if not parts:
        return None
    for part in parts:
        inline = getattr(part, "inline_data", None)
        if inline is not None and getattr(inline, "data", None):
            data = inline.data
            if isinstance(data, (bytes, bytearray)):
                b64 = base64.b64encode(bytes(data)).decode()
            else:
                b64 = str(data)
            mime = getattr(inline, "mime_type", None) or "image/png"
            return f"data:{mime};base64,{b64}"
    return None


async def generate_product_image(product_name: str) -> Optional[str]:
    """Return a data-URL image for the product, or None. Never raises."""
    if not config.ENABLE_PRODUCT_IMAGES or not config.has_api_key():
        return None
    if not product_name or not product_name.strip():
        return None
    key = product_name.strip().lower()
    if key in _cache:
        return _cache[key]
    try:
        from .live_session import get_client
        client = get_client()
        response = await client.aio.models.generate_content(
            model=config.IMAGE_MODEL,
            contents=_prompt_for(product_name),
            config=types.GenerateContentConfig(response_modalities=["IMAGE"]),
        )
        data_url = _extract_data_url(response)
        if data_url:
            _cache[key] = data_url
        return data_url
    except Exception:  # noqa: BLE001
        return None
