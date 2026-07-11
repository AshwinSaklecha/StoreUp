import { useEffect, useRef, useState } from "react";
import HomeScreen from "./components/HomeScreen.jsx";
import ScanningScreen from "./components/ScanningScreen.jsx";
import ReviewScreen from "./components/ReviewScreen.jsx";
import SuccessScreen from "./components/SuccessScreen.jsx";
import DebugPanel from "./components/DebugPanel.jsx";
import { useCamera } from "./hooks/useCamera.js";
import { useAudio } from "./hooks/useAudio.js";
import { useLiveSession } from "./hooks/useLiveSession.js";
import { useDebugMode } from "./hooks/useDebugMode.js";
import { VIDEO_FPS } from "./config.js";

export default function App() {
  const [stage, setStage] = useState("home");
  const [reviewOpen, setReviewOpen] = useState(false);
  const debugMode = useDebugMode();

  const [micOn, setMicOn] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const camera = useCamera();
  const audio = useAudio();
  const live = useLiveSession();
  const startedRef = useRef(false);
  const micOnRef = useRef(true);

  const toggleMic = () => {
    setMicOn((v) => {
      const next = !v;
      micOnRef.current = next;
      return next;
    });
  };

  useEffect(() => {
    if (stage !== "scanning" || startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    let videoTimer = null;
    (async () => {
      await camera.start();
      if (cancelled) return;
      live.connect({
        onAudio: audio.playChunk,
        onInterrupt: audio.clearPlayback,
        onFunctionCall: (msg) => {
          // When the AI itself triggers publish, show the same waiting page as
          // the manual button until the "published" result arrives.
          if (msg.name === "publish_store") setPublishing(true);
        },
      });
      try {
        await audio.startCapture((b64) => {
          if (micOnRef.current) live.sendAudio(b64);
        });
      } catch {
        /* mic denied — camera still streams */
      }
      videoTimer = setInterval(() => {
        const frame = camera.captureFrame();
        if (frame) live.sendVideo(frame);
      }, 1000 / VIDEO_FPS);
    })();

    return () => {
      cancelled = true;
      clearInterval(videoTimer);
      live.disconnect();
      audio.stop();
      camera.stop();
      startedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  useEffect(() => {
    if (live.publishResult) {
      setPublishing(false);
      setStage("success");
    }
  }, [live.publishResult]);

  // If publishing fails (e.g. no products), drop the waiting page.
  useEffect(() => {
    if (live.errorMsg) setPublishing(false);
  }, [live.errorMsg]);

  const goHome = () => {
    setReviewOpen(false);
    setPublishing(false);
    live.reset();
    setMicOn(true);
    micOnRef.current = true;
    setStage("home");
  };

  return (
    <div className={`app-layout ${debugMode ? "with-debug" : ""}`}>
      <div className="app-shell">
        {stage === "home" && (
          <HomeScreen onStart={() => setStage("scanning")} />
        )}

        {stage === "scanning" && (
          <ScanningScreen
            camera={camera}
            live={live}
            micOn={micOn}
            onToggleMic={toggleMic}
            onExit={goHome}
            onReview={() => setReviewOpen(true)}
          />
        )}

        {stage === "scanning" && reviewOpen && (
          <ReviewScreen
            products={live.products}
            onClose={() => setReviewOpen(false)}
            onRemove={live.removeProduct}
            onUpdate={live.updateProduct}
            onPublish={live.publish}
            errorMsg={live.errorMsg}
          />
        )}

        {stage === "success" && (
          <SuccessScreen result={live.publishResult} onDone={goHome} />
        )}

        {stage === "scanning" && publishing && (
          <div className="publish-overlay">
            <div className="spinner" />
            <div className="h2" style={{ marginTop: 14 }}>
              Publishing your store…
            </div>
            <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
              Building your ONDC catalog.
            </div>
          </div>
        )}
      </div>

      <DebugPanel live={live} debugMode={debugMode} />
    </div>
  );
}
