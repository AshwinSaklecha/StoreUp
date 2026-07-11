"""StoreUp FastAPI application."""

from __future__ import annotations

import base64

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from . import config, product_store
from .live_session import LiveBridge

app = FastAPI(title="StoreUp Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict:
    return {"service": "storeup-backend", "status": "ok"}


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "live_model": config.LIVE_MODEL,
        "agent_model": config.AGENT_MODEL,
        "api_key_configured": config.has_api_key(),
    }


@app.get("/catalog")
def catalog() -> dict:
    state = product_store.store.state
    return {
        "store_name": state.store_name,
        "description": state.description,
        "location": state.location,
        "published": state.published,
        "products": product_store.store.list_products(),
        "catalog_source": state.catalog_source,
        "catalog_valid": state.catalog_valid,
        "catalog": state.catalog,
    }


@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    product_store.store.reset()

    async def on_event(event: dict) -> None:
        try:
            await websocket.send_json(event)
        except Exception:
            pass

    bridge = LiveBridge(on_event=on_event)
    try:
        await bridge.start()
    except Exception as exc:
        await on_event({"type": "error", "message": str(exc)})
        await websocket.close()
        return

    try:
        while True:
            msg = await websocket.receive_json()
            mtype = msg.get("type")
            if mtype == "audio":
                await bridge.send_audio(base64.b64decode(msg["data"]))
            elif mtype == "video":
                await bridge.send_video(base64.b64decode(msg["data"]))
            elif mtype == "publish":
                await bridge.request_publish()
            elif mtype == "remove_product":
                await bridge.remove_product(msg.get("name", ""))
            elif mtype == "update_product":
                await bridge.update_product(
                    msg.get("name", ""),
                    price_inr=msg.get("price_inr"),
                    quantity=msg.get("quantity"),
                )
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # noqa: BLE001
        await on_event({"type": "error", "message": str(exc)})
    finally:
        await bridge.close()
