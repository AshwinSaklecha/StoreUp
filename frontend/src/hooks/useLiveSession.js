import { useCallback, useRef, useState } from "react";
import { WS_URL } from "../config.js";
import { base64ToBytes } from "../lib/binary.js";

function stamp() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function useLiveSession() {
  const wsRef = useRef(null);
  const handlersRef = useRef({});

  const [status, setStatus] = useState("idle");
  const [products, setProducts] = useState([]);
  const [caption, setCaption] = useState("");
  const [publishResult, setPublishResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [debugEvents, setDebugEvents] = useState([]);

  const pushDebug = useCallback((entry) => {
    setDebugEvents((prev) => [...prev.slice(-199), { time: stamp(), ...entry }]);
  }, []);

  const connect = useCallback((handlers = {}) => {
    handlersRef.current = handlers;
    setStatus("connecting");
    pushDebug({ kind: "connect", detail: WS_URL });
    let ws;
    try {
      ws = new WebSocket(WS_URL);
    } catch (err) {
      setStatus("error");
      setErrorMsg(String(err));
      pushDebug({ kind: "error", detail: String(err) });
      return;
    }
    wsRef.current = ws;
    ws.onopen = () => { setStatus("connecting"); pushDebug({ kind: "socket", detail: "open" }); };
    ws.onerror = () => { setStatus("error"); setErrorMsg("Could not reach the backend."); pushDebug({ kind: "error", detail: "websocket error" }); };
    ws.onclose = () => { setStatus((s) => (s === "error" ? s : "idle")); pushDebug({ kind: "socket", detail: "closed" }); };

    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      switch (msg.type) {
        case "ready": setStatus("live"); pushDebug({ kind: "ready", detail: "live session" }); break;
        case "audio": handlersRef.current.onAudio?.(base64ToBytes(msg.data)); break;
        case "interrupted": handlersRef.current.onInterrupt?.(); pushDebug({ kind: "interrupted" }); break;
        case "transcript":
          if (msg.text) {
            pushDebug({ kind: "transcript", role: msg.role || "assistant", text: msg.text });
            if (msg.role === "assistant") setCaption((c) => (msg.append ? c + msg.text : msg.text));
          }
          break;
        case "products":
          setProducts(msg.products || []);
          pushDebug({ kind: "products", detail: `${(msg.products || []).length} items` });
          break;
        case "function_call":
          pushDebug({ kind: "function_call", name: msg.name, args: msg.args, result: msg.result });
          handlersRef.current.onFunctionCall?.(msg);
          break;
        case "published":
          setPublishResult(msg);
          pushDebug({ kind: "published", detail: `${msg.source}, valid=${msg.valid}` });
          break;
        case "error":
          setErrorMsg(msg.message || "Backend error");
          setStatus("error");
          pushDebug({ kind: "error", detail: msg.message });
          break;
        default:
          pushDebug({ kind: msg.type || "event" });
          break;
      }
    };
  }, [pushDebug]);

  const send = useCallback((obj) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  }, []);

  const sendAudio = useCallback((b64) => send({ type: "audio", data: b64 }), [send]);
  const sendVideo = useCallback((b64) => send({ type: "video", data: b64 }), [send]);
  const publish = useCallback(() => { pushDebug({ kind: "publish", detail: "button tapped" }); send({ type: "publish" }); }, [send, pushDebug]);
  const removeProduct = useCallback((name) => send({ type: "remove_product", name }), [send]);
  const updateProduct = useCallback((name, fields) => send({ type: "update_product", name, ...fields }), [send]);

  const disconnect = useCallback(() => {
    try { wsRef.current?.close(); } catch { /* noop */ }
    wsRef.current = null;
    setStatus("idle");
  }, []);

  const reset = useCallback(() => {
    disconnect();
    setProducts([]);
    setCaption("");
    setPublishResult(null);
    setErrorMsg("");
    setDebugEvents([]);
    setStatus("idle");
  }, [disconnect]);

  return { status, products, caption, publishResult, errorMsg, debugEvents, connect, disconnect, reset, sendAudio, sendVideo, publish, removeProduct, updateProduct };
}
