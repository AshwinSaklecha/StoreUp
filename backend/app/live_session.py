"""Gemini Live API session management for StoreUp."""

from __future__ import annotations

import asyncio
import base64
from dataclasses import dataclass, field
from typing import Awaitable, Callable, Optional, Sequence

from google import genai
from google.genai import types

from . import config, function_handlers, image_gen, product_store

AUDIO_CHUNK_FRAMES = 1024


def get_client() -> genai.Client:
    if not config.has_api_key():
        raise RuntimeError(
            "GEMINI_API_KEY is not set. Put your real key in the .env file, then rerun."
        )
    return genai.Client(api_key=config.GEMINI_API_KEY)


def build_live_config(
    *,
    tools: Optional[Sequence[object]] = None,
    enable_input_transcription: bool = False,
    set_media_resolution: bool = False,
) -> types.LiveConnectConfig:
    cfg = types.LiveConnectConfig(
        response_modalities=[types.Modality.AUDIO],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=config.VOICE_NAME)
            )
        ),
        system_instruction=config.SYSTEM_PROMPT,
        output_audio_transcription=types.AudioTranscriptionConfig(),
        context_window_compression=types.ContextWindowCompressionConfig(
            sliding_window=types.SlidingWindow(target_tokens=50_000)
        ),
    )
    if enable_input_transcription:
        cfg.input_audio_transcription = types.AudioTranscriptionConfig()
    if set_media_resolution:
        cfg.media_resolution = types.MediaResolution(config.MEDIA_RESOLUTION)
    if tools:
        cfg.tools = list(tools)
    return cfg


@dataclass
class TurnResult:
    audio: bytes = b""
    output_transcript: str = ""
    input_transcript: str = ""
    tool_calls: list = field(default_factory=list)

    @property
    def has_audio(self) -> bool:
        return len(self.audio) > 0


AudioCallback = Callable[[bytes], Awaitable[None] | None]


async def receive_turn(session, *, on_audio: Optional[AudioCallback] = None) -> TurnResult:
    result = TurnResult()
    async for message in session.receive():
        if message.data:
            result.audio += message.data
            if on_audio is not None:
                maybe_awaitable = on_audio(message.data)
                if maybe_awaitable is not None:
                    await maybe_awaitable
        server_content = message.server_content
        if server_content is not None:
            if server_content.output_transcription and server_content.output_transcription.text:
                result.output_transcript += server_content.output_transcription.text
            if server_content.input_transcription and server_content.input_transcription.text:
                result.input_transcript += server_content.input_transcription.text
            if server_content.turn_complete:
                break
        if message.tool_call and message.tool_call.function_calls:
            result.tool_calls.extend(message.tool_call.function_calls)
    return result


async def run_text_turn(prompt: str) -> TurnResult:
    client = get_client()
    live_config = build_live_config()
    async with client.aio.live.connect(model=config.LIVE_MODEL, config=live_config) as session:
        await session.send_realtime_input(text=prompt)
        return await receive_turn(session)


class LiveBridge:
    """Bridges a browser WebSocket to a Gemini Live API session."""

    def __init__(self, on_event: Callable[[dict], Awaitable[None]]) -> None:
        self._on_event = on_event
        self._session = None
        self._cm = None
        self._recv_task: Optional[asyncio.Task] = None
        self._tool_call_active = False
        self._assistant_buf = ""
        self._user_buf = ""
        self._published = False

    async def start(self) -> None:
        client = get_client()
        live_config = build_live_config(
            tools=function_handlers.get_tools(enable_search=True),
            enable_input_transcription=True,
            set_media_resolution=True,
        )
        self._cm = client.aio.live.connect(model=config.LIVE_MODEL, config=live_config)
        self._session = await self._cm.__aenter__()
        self._recv_task = asyncio.create_task(self._receive_loop())
        self._audio_in = 0
        self._video_in = 0
        self._audio_out = 0
        print("[StoreUp][DEBUG] Live session started, model=", config.LIVE_MODEL, flush=True)
        await self._on_event({"type": "ready"})

    async def send_audio(self, pcm_bytes: bytes) -> None:
        if self._session and not self._tool_call_active:
            self._audio_in = getattr(self, "_audio_in", 0) + 1
            if self._audio_in % 50 == 1:
                print(f"[StoreUp][DEBUG] audio chunks received from browser: {self._audio_in} (last={len(pcm_bytes)} bytes)", flush=True)
            await self._session.send_realtime_input(
                audio=types.Blob(data=pcm_bytes, mime_type=f"audio/pcm;rate={config.INPUT_SAMPLE_RATE}")
            )

    async def send_video(self, jpeg_bytes: bytes) -> None:
        if self._session and not self._tool_call_active:
            self._video_in = getattr(self, "_video_in", 0) + 1
            if self._video_in % 10 == 1:
                print(f"[StoreUp][DEBUG] video frames received from browser: {self._video_in} (last={len(jpeg_bytes)} bytes)", flush=True)
            await self._session.send_realtime_input(
                video=types.Blob(data=jpeg_bytes, mime_type="image/jpeg")
            )

    async def request_publish(self) -> None:
        state = product_store.store.state
        if not state.products:
            await self._on_event({"type": "error", "message": "No products to publish."})
            return
        store_name = state.store_name or "My Store"
        if not state.description:
            product_store.store.set_description(store_name, location=state.location)
        product_store.store.publish(store_name, gps=state.gps)
        await self._on_event({"type": "products", "products": product_store.store.list_products()})
        await self._emit_published()

    async def remove_product(self, name: str) -> None:
        product_store.store.remove_product(name)
        await self._on_event({"type": "products", "products": product_store.store.list_products()})

    async def update_product(self, name: str, price_inr=None, quantity=None) -> None:
        product_store.store.update_product(name, price_inr=price_inr, quantity=quantity)
        await self._on_event({"type": "products", "products": product_store.store.list_products()})

    async def _receive_loop(self) -> None:
        try:
            while True:
                async for message in self._session.receive():
                    if message.data:
                        self._audio_out = getattr(self, "_audio_out", 0) + 1
                        if self._audio_out % 50 == 1:
                            print(f"[StoreUp][DEBUG] audio chunks produced by model: {self._audio_out}", flush=True)
                        await self._on_event({"type": "audio", "data": base64.b64encode(message.data).decode()})
                    if message.tool_call and message.tool_call.function_calls:
                        await self._handle_tool_call(message.tool_call)
                    sc = message.server_content
                    if sc is None:
                        continue
                    if sc.input_transcription and sc.input_transcription.text:
                        self._user_buf += sc.input_transcription.text
                        print(f"[StoreUp][DEBUG] USER said: {sc.input_transcription.text!r}", flush=True)
                        await self._on_event({"type": "transcript", "role": "user", "text": self._user_buf, "append": False})
                    if sc.output_transcription and sc.output_transcription.text:
                        self._assistant_buf += sc.output_transcription.text
                        print(f"[StoreUp][DEBUG] MODEL said: {sc.output_transcription.text!r}", flush=True)
                        await self._on_event({"type": "transcript", "role": "assistant", "text": self._assistant_buf, "append": False})
                    if sc.interrupted:
                        await self._on_event({"type": "interrupted"})
                    if sc.turn_complete:
                        self._assistant_buf = ""
                        self._user_buf = ""
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001
            await self._on_event({"type": "error", "message": str(exc)})

    async def _handle_tool_call(self, tool_call) -> None:
        self._tool_call_active = True
        published = False
        image_targets: list[str] = []
        try:
            responses = []
            for fc in tool_call.function_calls:
                args = fc.args or {}
                result = function_handlers.execute(fc.name, args)
                responses.append(types.FunctionResponse(id=fc.id, name=fc.name, response=result))
                await self._on_event({"type": "function_call", "name": fc.name, "args": args, "result": result})
                if fc.name == "add_product" and result.get("status") in ("added", "updated"):
                    pn = (result.get("product") or {}).get("product_name") or args.get("product_name")
                    if pn:
                        image_targets.append(pn)
                if fc.name == "publish_store" and result.get("status") == "published":
                    published = True
            if responses:
                await self._session.send_tool_response(function_responses=responses)
            await self._on_event({"type": "products", "products": product_store.store.list_products()})
            self._spawn_image_jobs(image_targets)
            if published:
                await self._emit_published()
        finally:
            self._tool_call_active = False

    def _spawn_image_jobs(self, product_names) -> None:
        if not config.ENABLE_PRODUCT_IMAGES:
            return
        for name in product_names:
            asyncio.create_task(self._make_image(name))

    async def _make_image(self, name: str) -> None:
        data_url = await image_gen.generate_product_image(name)
        if data_url:
            product_store.store.set_image(name, data_url)

    async def _emit_published(self) -> None:
        from . import agent_trigger, beckn_builder  # noqa: PLC0415
        if self._published:
            return
        self._published = True
        missing = [p["product_name"] for p in product_store.store.list_products() if not p.get("image")]
        self._spawn_image_jobs(missing)
        result = await agent_trigger.generate_beckn_catalog(product_store.store.state, mode=config.BECKN_MODE)
        product_store.store.set_catalog(result["catalog"], source=result["source"], valid=result["valid"])
        await self._on_event({
            "type": "published",
            "source": result["source"],
            "valid": result["valid"],
            "catalog": result["catalog"],
            "mock_fields": beckn_builder.MOCK_FIELDS,
            "store_name": product_store.store.state.store_name,
            "description": product_store.store.state.description,
            "products": product_store.store.list_products(),
        })

    async def close(self) -> None:
        if self._recv_task is not None:
            self._recv_task.cancel()
            try:
                await self._recv_task
            except (asyncio.CancelledError, Exception):
                pass
        if self._cm is not None:
            try:
                await self._cm.__aexit__(None, None, None)
            except Exception:
                pass
        self._session = None
        self._cm = None
