# StoreUp — Talk your shop onto ONDC

**Turn any local shop into a live online store just by walking through it and talking.**

A shopkeeper points their phone at the shelf and speaks in their own language.
StoreUp *sees* the products through the camera, *hears* the shopkeeper live,
confirms each item conversationally, and publishes a valid **ONDC** catalog that
buyers across India can shop — no typing, no forms, no English required.

> Built for the **Google DeepMind Bangalore Hackathon** — Problem Statement 1:
> *Real-Time Multimodal Interaction* (Gemini Live API), with **Nano Banana 2
> Lite** driving a real-time product-image pipeline.

---

## Why this isn't "a chatbox with a mic"

The whole experience is built around the live, multimodal loop — it would be
impossible to do typed into a text box:

- **Sees + hears continuously.** The camera feed and microphone stream to Gemini
  Live at the same time. The assistant recognizes products by brand/variant as
  they come into view ("Oh, those are Lay's Classic").
- **Interruptible + real-time.** You can talk over it, correct it mid-sentence,
  and it adapts instantly.
- **Speaks any Indian language.** Hindi, Kannada, Tamil, Telugu, English or a
  mix — and switches the moment the shopkeeper switches.
- **Proactive vision.** It points out products you *didn't* mention, and asks
  ("how many of those?") instead of guessing counts it can't see clearly.

---

## How it works (end to end)

```
Phone (React PWA)                 FastAPI backend                Google AI
─────────────────                 ───────────────                ─────────
 mic (PCM 16k)  ───▶  WebSocket ───▶  Gemini Live bridge  ───▶  Gemini Live API
 camera (1 fps) ───▶               ◀── audio replies ◀───────   (audio+video in,
                                                                  audio out)
                       function calls: add_product / describe / publish
                                  │
                                  ├─▶  In-memory product store
                                  ├─▶  Beckn v1.2.0 catalog builder (ONDC RET10)
                                  └─▶  Nano Banana 2 Lite ── product images
                                  │
 Buyer app (mock ONDC)  ◀── /catalog ── published store snapshot
```

1. **Scan & speak** — shopkeeper walks the shelf; audio + 1 fps video stream to
   Gemini Live over a WebSocket.
2. **Converse** — the model confirms each product's name, price and quantity out
   loud, then calls `add_product()`.
3. **Publish** — on confirmation it names the store, generates a description, and
   builds a **valid ONDC Beckn `on_search` catalog** (RET10 / Grocery).
4. **Product images** — **Nano Banana 2 Lite** generates catalog images in the
   background (cached, with emoji fallback) so the store looks real instantly.
5. **Buyer app** — a mock ONDC buyer app reads the published catalog and shows
   the live storefront, searchable by product.

---

## Google AI stack used

| Capability | Model / API |
|---|---|
| Live voice + camera conversation | `gemini-3.1-flash-live-preview` (Gemini Live API) |
| Real-time product images | `gemini-3.1-flash-lite-image` (Nano Banana 2 Lite) |
| Market-price sanity checks | Google Search grounding (in the Live session) |
| Beckn catalog (optional agent path) | Managed Agent `antigravity-preview-05-2026` → `gemini-3.5-flash` → deterministic builder |

Function calling, Google Search grounding, and audio+video streaming all run
**inside a single Gemini Live session**.

---

## Run it locally

**Prerequisites:** Python 3.11+, Node 18+, a Gemini API key.

### 1. Configure

```bash
cp .env.example .env
# then edit .env and set GEMINI_API_KEY=...
```

### 2. Backend (FastAPI, port 8000)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows  (source .venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
python run.py
```

### 3. Frontend (Vite + React, port 5173)

```bash
cd frontend
npm install
npm run dev
```

Open the printed **Network** URL on your phone (same WiFi). Camera + mic need a
secure origin — on a LAN IP, whitelist it via
`chrome://flags/#unsafely-treat-insecure-origin-as-secure`.

- Onboarding app: `/`
- Buyer app: `/buyer`
- Judge/debug panel: append `?debug=1`

---

## What's real vs. mocked (honest scope)

**Real:**
- Live audio + video streaming to Gemini Live, function calling, and voice replies
- Multilingual conversation and product recognition
- Nano Banana 2 Lite image generation
- A schema-valid ONDC Beckn v1.2.0 `on_search` catalog (validated in code)

**Mocked / simplified for the demo:**
- The **buyer app** is our own mock ONDC storefront (not the live ONDC gateway).
- Store data is **in-memory** for a single session (no database) — the published
  store is snapshotted so the buyer app keeps showing it. Restarting the backend
  resets everything.
- We don't register on the real ONDC network; we generate the exact catalog
  payload ONDC expects.

---

## Configuration reference

| Variable | Purpose | Default |
|---|---|---|
| `GEMINI_API_KEY` | Gemini API key (never commit real key) | — |
| `LIVE_MODEL` | Live audio+video model | `gemini-3.1-flash-live-preview` |
| `IMAGE_MODEL` | Nano Banana 2 Lite | `gemini-3.1-flash-lite-image` |
| `ENABLE_PRODUCT_IMAGES` | Toggle image generation | `true` |
| `BECKN_MODE` | `deterministic` (demo-safe) or `auto` (agent path) | `deterministic` |
| `AGENT_ID` / `AGENT_MODEL` | Managed Agent + fallback for Beckn JSON | see `.env.example` |

---

## Project structure

```
backend/
  app/
    live_session.py     # Gemini Live <-> browser WebSocket bridge
    function_handlers.py # add_product / generate_store_description / publish_store
    product_store.py     # in-memory inventory + published snapshot
    beckn_builder.py     # deterministic ONDC Beckn v1.2.0 catalog + validator
    agent_trigger.py     # managed agent / self-correct / deterministic strategies
    image_gen.py         # Nano Banana 2 Lite product images
    config.py            # models, ONDC constants, system prompt
    main.py              # FastAPI app + endpoints
  run.py
frontend/
  src/
    components/          # Home, Scanning, Review, Success, BuyerAppMock, DebugPanel
    hooks/               # useLiveSession, useAudio, useCamera
    styles.css
  public/fonts/          # self-hosted Montserrat + Plus Jakarta Sans
```

---

_The `.env` file is git-ignored; only `.env.example` (placeholders) is committed._
