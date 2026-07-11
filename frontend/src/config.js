const backendPort = 8000;

function deriveWsUrl() {
  if (import.meta.env.VITE_BACKEND_WS) return import.meta.env.VITE_BACKEND_WS;
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.hostname || "localhost";
  return `${proto}://${host}:${backendPort}/ws`;
}

function deriveApiUrl() {
  if (import.meta.env.VITE_BACKEND_API) return import.meta.env.VITE_BACKEND_API;
  const proto = window.location.protocol === "https:" ? "https" : "http";
  const host = window.location.hostname || "localhost";
  return `${proto}://${host}:${backendPort}`;
}

export const WS_URL = deriveWsUrl();
export const API_URL = deriveApiUrl();

export const INPUT_SAMPLE_RATE = 16000;
export const OUTPUT_SAMPLE_RATE = 24000;
export const VIDEO_FRAME_SIZE = 768;
export const VIDEO_FPS = 1;
