import { useEffect, useState } from "react";
import { API_URL } from "../config.js";

const FEATURES = [
  "Speak any language",
  "Point at your shelf",
  "No typing",
  "Live on ONDC",
];

export default function HomeScreen({ onStart }) {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/health`)
      .then((r) => r.json())
      .then((d) => active && setHealth(d))
      .catch(() => active && setHealth({ status: "error" }));
    return () => {
      active = false;
    };
  }, []);

  const backendOk = health?.status === "ok";
  const keyOk = health?.api_key_configured;
  const ready = backendOk && keyOk;

  return (
    <div className="home">
      <div className="home-hero">
        <div className="brand">
          <span className="brand-dot" />
          <span>StoreUp</span>
        </div>
        <h1 className="h1">
          Turn your shop into an online store — just by talking.
        </h1>
        <p>
          Walk through your shop, point your phone at the shelf, and speak in
          your language. StoreUp lists your products on India&rsquo;s ONDC
          network for you.
        </p>
        <div className="pill-row">
          {FEATURES.map((f) => (
            <span className="pill" key={f}>
              {f}
            </span>
          ))}
        </div>

        {health && (
          <div className="status-row">
            <span className={`tag ${backendOk ? "ok" : ""}`}>
              Backend {backendOk ? "online" : "offline"}
            </span>
            <span className={`tag ${keyOk ? "ok" : ""}`}>
              API key {keyOk ? "set" : "missing"}
            </span>
          </div>
        )}
      </div>

      <div>
        {!ready && health && (
          <p className="home-hint muted">
            {!backendOk
              ? "Start the backend: cd backend && python run.py"
              : "Paste your GEMINI_API_KEY into .env at the repo root."}
          </p>
        )}
        <button
          className="btn btn-primary btn-block"
          onClick={onStart}
          disabled={!ready}
        >
          Start scanning
        </button>
      </div>
    </div>
  );
}
