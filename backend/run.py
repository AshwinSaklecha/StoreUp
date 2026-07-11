"""Dev entrypoint: start the StoreUp FastAPI server with uvicorn.

    python run.py
or
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

Run from the `backend/` directory so `app` is importable.
"""

from __future__ import annotations

import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
