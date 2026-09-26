"use client";

// Web Audio API based Sound FX synthesizer for WACRM
// Generates crystal-clear, zero-latency chimes without requiring external audio assets.

const SOUND_PREF_KEY = "wacrm:sound:enabled";

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const val = localStorage.getItem(SOUND_PREF_KEY);
    return val === null ? true : val === "true";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SOUND_PREF_KEY, String(enabled));
    window.dispatchEvent(new CustomEvent("wacrm:sound:changed", { detail: enabled }));
  } catch {}
}

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxClass) return null;
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new AudioCtxClass();
    }
    if (audioCtx.state === "suspended") {
      void audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

export type SoundType = "incoming" | "outgoing" | "order" | "alert";

/**
 * Plays a pleasant synthesizer chime for system events.
 */
export function playSound(type: SoundType): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  if (type === "incoming") {
    // Elegant two-note WhatsApp/Slack style chime (D5 -> A5)
    playTone(ctx, 587.33, now, 0.12, 0.15); // D5
    playTone(ctx, 880.0, now + 0.1, 0.22, 0.12); // A5
  } else if (type === "outgoing") {
    // Soft, subtle pop for sent messages
    playTone(ctx, 659.25, now, 0.08, 0.08); // E5
  } else if (type === "order") {
    // Triumphant 3-note chord for new order confirmation (C5 -> E5 -> G5)
    playTone(ctx, 523.25, now, 0.15, 0.15); // C5
    playTone(ctx, 659.25, now + 0.08, 0.15, 0.15); // E5
    playTone(ctx, 783.99, now + 0.16, 0.35, 0.2); // G5
  } else if (type === "alert") {
    // Attention ping for high-risk / urgent items
    playTone(ctx, 440.0, now, 0.1, 0.15);
    playTone(ctx, 440.0, now + 0.14, 0.18, 0.15);
  }
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  volume: number
) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(volume, startTime);
    // Smooth exponential decay
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  } catch {}
}
