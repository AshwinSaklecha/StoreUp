"""Trigger Beckn catalog generation after publish_store().

Three strategies tried in order by generate_beckn_catalog(mode="auto"):
  1. Managed Agent (Antigravity) via Interactions API
  2. Plain model interaction with validate -> self-correct loop
  3. Deterministic local builder (always valid, used for demo)
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from . import beckn_builder, config
from .live_session import get_client
from .product_store import StoreState

_SKILL_PATH = Path(__file__).resolve().parents[1] / "skills" / "beckn-catalog-generator" / "SKILL.md"
_MAX_CORRECTION_ATTEMPTS = 2


def _load_skill() -> str:
    try:
        return _SKILL_PATH.read_text(encoding="utf-8")
    except OSError:
        return ""


def _store_payload(state: StoreState) -> str:
    return json.dumps(
        {
            "store": {"store_name": state.store_name, "location": state.location, "description": state.description, "gps": state.gps or config.DEFAULT_GPS},
            "products": [{"product_name": p.product_name, "price_inr": p.price_inr, "quantity": p.quantity, "category": p.category} for p in state.products],
        },
        ensure_ascii=False, indent=2,
    )


def _build_prompt(state: StoreState) -> str:
    return (
        f"{_load_skill()}\n\n"
        "Generate the ONDC Beckn v1.2.0 on_search catalog for the following "
        "store. Output ONLY the final JSON object, no markdown, no commentary.\n\n"
        f"{_store_payload(state)}"
    )


def _extract_json(text: Optional[str]) -> Optional[dict]:
    if not text:
        return None
    s = text.strip()
    if s.startswith("```"):
        s = s.split("```", 2)[1] if s.count("```") >= 2 else s.strip("`")
        if s.lstrip().lower().startswith("json"):
            s = s.lstrip()[4:]
    start, end = s.find("{"), s.rfind("}")
    if start == -1 or end == -1 or end < start:
        return None
    try:
        return json.loads(s[start: end + 1])
    except json.JSONDecodeError:
        return None


async def _run_managed_agent(state: StoreState) -> dict:
    client = get_client()
    interaction = await client.aio.interactions.create(agent=config.AGENT_ID, input=_build_prompt(state), response_mime_type="application/json")
    catalog = _extract_json(interaction.output_text)
    if catalog is None:
        raise ValueError("Managed Agent returned no parseable JSON")
    ok, errors = beckn_builder.validate_catalog(catalog)
    if not ok:
        raise ValueError(f"Managed Agent output failed validation: {errors[:5]}")
    return catalog


async def _run_model_with_self_correction(state: StoreState) -> dict:
    client = get_client()
    interaction = await client.aio.interactions.create(model=config.AGENT_MODEL, input=_build_prompt(state), response_mime_type="application/json")
    catalog = _extract_json(interaction.output_text)
    ok, errors = beckn_builder.validate_catalog(catalog or {})
    attempts = 0
    while not ok and attempts < _MAX_CORRECTION_ATTEMPTS:
        attempts += 1
        interaction = await client.aio.interactions.create(
            model=config.AGENT_MODEL,
            previous_interaction_id=interaction.id,
            input=("The previous JSON failed validation with these errors:\n" + "\n".join(f"- {e}" for e in errors) + "\nReturn ONLY the corrected full JSON object."),
            response_mime_type="application/json",
        )
        catalog = _extract_json(interaction.output_text)
        ok, errors = beckn_builder.validate_catalog(catalog or {})
    if not ok:
        raise ValueError(f"Model output failed validation: {errors[:5]}")
    return catalog  # type: ignore[return-value]


async def generate_beckn_catalog(state: StoreState, *, mode: str = "auto") -> dict:
    if mode in ("agent", "auto") and config.has_api_key():
        try:
            catalog = await _run_managed_agent(state)
            return _result(catalog, "managed_agent")
        except Exception as exc:  # noqa: BLE001
            if mode == "agent":
                return _result_fallback(state, f"managed_agent failed: {exc}")

    if mode in ("model", "auto") and config.has_api_key():
        try:
            catalog = await _run_model_with_self_correction(state)
            return _result(catalog, "model_self_correct")
        except Exception as exc:  # noqa: BLE001
            if mode == "model":
                return _result_fallback(state, f"model failed: {exc}")

    catalog = beckn_builder.build_catalog(state)
    return _result(catalog, "deterministic")


def _result(catalog: dict, source: str) -> dict:
    ok, errors = beckn_builder.validate_catalog(catalog)
    return {"catalog": catalog, "source": source, "valid": ok, "errors": errors}


def _result_fallback(state: StoreState, note: str) -> dict:
    catalog = beckn_builder.build_catalog(state)
    ok, errors = beckn_builder.validate_catalog(catalog)
    return {"catalog": catalog, "source": "deterministic", "valid": ok, "errors": errors, "note": note}
