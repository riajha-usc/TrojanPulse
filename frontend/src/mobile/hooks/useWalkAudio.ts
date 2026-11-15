import { useEffect, useRef, useState } from "react";
import { isAbortError, sendAudio } from "../api";
import { CONFIG } from "../config";
import type { Schema } from "../types";

export type AudioResult = Schema["AudioChunkResponse"];
export type AudioStatus = "idle" | "requesting" | "listening" | "denied" | "unsupported" | "error";
type Options = { walkId: string; enabled: boolean; onTrigger: (result: AudioResult) => void };

export function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
    .find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function buildAudioForm(blob: Blob, sequence: number): FormData {
  const extension = blob.type.includes("mp4") ? "mp4" : blob.type.includes("webm") ? "webm" : null;
  if (!extension) throw new Error("The recorded audio format is not supported by the server.");
  const form = new FormData();
  form.append("audio", new File([blob], "clip-" + sequence + "." + extension, { type: blob.type }));
  form.append("sound_score", "0");
  form.append("sudden_stop", "false");
  return form;
}

/** One complete file per start/stop cycle. Abort discards the incomplete recording. */
export function recordClip(
  stream: MediaStream, mimeType: string, durationMs: number, signal: AbortSignal,
  onStarted: () => void = () => {},
): Promise<Blob | null> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { resolve(null); return; }
    let recorder: MediaRecorder;
    try { recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined); }
    catch (error) { reject(error); return; }

    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const parts: Blob[] = [];
    const finish = (blob: Blob | null, error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(watchdog);
      signal.removeEventListener("abort", abort);
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      if (recorder.state !== "inactive") {
        try { recorder.stop(); } catch { /* Track cleanup is owned by the hook. */ }
      }
      if (error) reject(error); else resolve(blob);
    };
    const abort = () => finish(null);
    recorder.ondataavailable = (event) => { if (event.data.size > 0) parts.push(event.data); };
    recorder.onerror = () => finish(null, new Error("Audio recording failed."));
    recorder.onstop = () => {
      if (signal.aborted) { finish(null); return; }
      const type = recorder.mimeType || parts[0]?.type || mimeType;
      finish(parts.length ? new Blob(parts, { type }) : null);
    };
    signal.addEventListener("abort", abort, { once: true });
    try {
      recorder.start(); // No timeslice: every upload must be independently decodable.
      onStarted();
      if (settled || signal.aborted) { finish(null); return; }
      timer = setTimeout(() => {
        if (signal.aborted) { finish(null); return; }
        try { recorder.stop(); }
        catch { finish(null, new Error("Could not finish the audio clip.")); }
      }, durationMs);
      watchdog = setTimeout(() => finish(null, new Error("The audio recorder stopped responding.")),
        durationMs + CONFIG.requestTimeoutMs);
    } catch (error: unknown) {
      finish(null, error instanceof Error ? error : new Error("Could not start recording."));
    }
  });
}

export function useWalkAudio({ walkId, enabled, onTrigger }: Options) {
  const callback = useRef(onTrigger);
  useEffect(() => { callback.current = onTrigger; }, [onTrigger]);
  const [status, setStatus] = useState<AudioStatus>("idle");
  const [error, setError] = useState("");
  const [uploadFailing, setUploadFailing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) { setStatus("idle"); return; }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined") {
      setStatus("unsupported");
      setError("Microphone recording requires a supported browser on localhost or HTTPS.");
      return;
    }

    const controller = new AbortController();
    let active = true;
    let stream: MediaStream | null = null;
    let pending: { blob: Blob; sequence: number } | null = null;
    let uploading = false;
    let track: MediaStreamTrack | undefined;

    const release = () => {
      active = false;
      pending = null;
      controller.abort();
      track?.removeEventListener("ended", disconnected);
      stream?.getTracks().forEach((item) => item.stop());
    };
    const disconnected = () => {
      if (!active) return;
      setStatus("error");
      setError("The microphone disconnected. Use Hold for help or restart listening.");
      release();
    };

    async function drain() {
      if (uploading) return;
      uploading = true;
      try {
        while (active && pending) {
          const next: { blob: Blob; sequence: number } = pending;
          pending = null;
          try {
            const result = await sendAudio(walkId, buildAudioForm(next.blob, next.sequence), controller.signal);
            if (!active) return;
            setUploadFailing(false);
            if (result.triggered) {
              release(); // Stop tracks before opening the countdown.
              setStatus("idle");
              callback.current(result);
              return;
            }
          } catch (caught: unknown) {
            if (!active || isAbortError(caught)) return;
            setUploadFailing(true);
          }
        }
      } finally { uploading = false; }
    }

    async function start() {
      setStatus("requesting");
      setError("");
      setUploadFailing(false);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
        });
        if (!active) return;
        track = stream.getAudioTracks()[0];
        if (!track) throw new Error("No microphone was found.");
        track.addEventListener("ended", disconnected);
        const mimeType = pickMimeType();
        let sequence = 0;
        let emptyClips = 0;
        while (active && stream.active) {
          const blob = await recordClip(stream, mimeType, CONFIG.audioChunkMs, controller.signal,
            () => { if (active) setStatus("listening"); });
          if (!active) break;
          if (!blob || blob.size === 0) {
            if (++emptyClips >= 3) throw new Error("The microphone returned no audio.");
            continue;
          }
          emptyClips = 0;
          pending = { blob, sequence: ++sequence }; // One latest pending clip, not an unbounded queue.
          void drain();
        }
        if (active) throw new Error("The microphone stopped.");
      } catch (caught: unknown) {
        if (active) {
          const denied = caught instanceof Error &&
            (caught.name === "NotAllowedError" || caught.name === "SecurityError");
          setStatus(denied ? "denied" : "error");
          setError(denied ? "Microphone access was denied. Allow it or use Hold for help." :
            caught instanceof Error ? caught.message : "Could not record audio.");
        }
      } finally { release(); }
    }

    void start();
    return release;
  }, [walkId, enabled, attempt]);

  return { status, error, uploadFailing, restart: () => setAttempt((value) => value + 1) };
}
