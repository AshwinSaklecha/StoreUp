"""Throwaway helper: list every model the current GEMINI_API_KEY can access.

Reads the key from ../.env (never prints it) and prints each model's ID plus
its supported actions, so we can confirm the exact model-ID strings to use.
"""

from pathlib import Path

from dotenv import load_dotenv
from google import genai

REPO_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(REPO_ROOT / ".env", override=False)

import os

key = os.getenv("GEMINI_API_KEY", "")
if not key or key == "your_key_here":
    raise SystemExit("No GEMINI_API_KEY found in .env")

client = genai.Client(api_key=key)

print("Models visible to this key:\n")
for m in client.models.list():
    actions = getattr(m, "supported_actions", None) or getattr(
        m, "supported_generation_methods", None
    )
    print(f"{m.name}")
    if actions:
        print(f"    actions: {actions}")
