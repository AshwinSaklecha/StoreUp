import { useCallback, useRef } from "react";
import { INPUT_SAMPLE_RATE, OUTPUT_SAMPLE_RATE } from "../config.js";
import { bytesToBase64, floatTo16BitPCM, pcm16ToFloat32 } from "../lib/binary.js";

function downsample(float32, inRate, outRate) {
  if (inRate === outRate) return float32;
  const ratio = inRate / outRate;
  const outLen = Math.floor(float32.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) out[i] = float32[Math.floor(i * ratio)];
  return out;
}

export function useAudio() {
  const captureCtxRef = useRef(null);
  const captureNodeRef = useRef(null);
  const micStreamRef = useRef(null);
  const playCtxRef = useRef(null);
  const playHeadRef = useRef(0);
  const sourcesRef = useRef(new Set());

  const startCapture = useCallback(async (onChunk) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
    micStreamRef.current = stream;
    let ctx;
    try {
      ctx = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
    } catch {
      ctx = new AudioContext();
    }
    captureCtxRef.current = ctx;
    await ctx.audioWorklet.addModule("/pcm-worklet.js");
    const source = ctx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(ctx, "pcm-processor");
    captureNodeRef.current = node;
    node.port.onmessage = (e) => {
      let float32 = e.data;
      if (ctx.sampleRate !== INPUT_SAMPLE_RATE) {
        float32 = downsample(float32, ctx.sampleRate, INPUT_SAMPLE_RATE);
      }
      const pcm = floatTo16BitPCM(float32);
      onChunk(bytesToBase64(pcm));
    };
    source.connect(node);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    node.connect(mute);
    mute.connect(ctx.destination);
  }, []);

  const ensurePlayCtx = useCallback(() => {
    if (!playCtxRef.current) {
      playCtxRef.current = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
      playHeadRef.current = 0;
    }
    return playCtxRef.current;
  }, []);

  const playChunk = useCallback((bytes) => {
    const ctx = ensurePlayCtx();
    const float32 = pcm16ToFloat32(bytes);
    if (!float32.length) return;
    const buffer = ctx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(float32, 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const now = ctx.currentTime;
    const startAt = Math.max(now, playHeadRef.current);
    src.start(startAt);
    playHeadRef.current = startAt + buffer.duration;
    sourcesRef.current.add(src);
    src.onended = () => sourcesRef.current.delete(src);
  }, [ensurePlayCtx]);

  const clearPlayback = useCallback(() => {
    sourcesRef.current.forEach((s) => { try { s.stop(); } catch { /* noop */ } });
    sourcesRef.current.clear();
    if (playCtxRef.current) playHeadRef.current = playCtxRef.current.currentTime;
  }, []);

  const stop = useCallback(() => {
    clearPlayback();
    captureNodeRef.current?.port && (captureNodeRef.current.port.onmessage = null);
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    captureCtxRef.current?.close().catch(() => {});
    playCtxRef.current?.close().catch(() => {});
    captureCtxRef.current = null;
    playCtxRef.current = null;
  }, [clearPlayback]);

  return { startCapture, playChunk, clearPlayback, stop };
}
