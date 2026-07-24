"use client";

// A tiny shared "master volume" store -- every hover-preview clip reads this
// as its fade-in target instead of a hardcoded constant, and the navbar's
// slider writes to it. Plain <audio>.volume, no Web Audio/AudioContext (see
// [[audio-context-gesture-gotcha]] memory: that route silenced playback
// entirely since mouseenter doesn't unlock a suspended AudioContext).
const STORAGE_KEY = "battle-rap:volume";
const DEFAULT_VOLUME = 0.5; // matches the old hardcoded fade-in target

function clamp(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function loadInitial(): number {
  if (typeof window === "undefined") return DEFAULT_VOLUME;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  const parsed = stored != null ? Number(stored) : NaN;
  return Number.isFinite(parsed) ? clamp(parsed) : DEFAULT_VOLUME;
}

let volume = DEFAULT_VOLUME;
let initialized = false;
const listeners = new Set<(v: number) => void>();

function ensureInitialized() {
  if (!initialized) {
    volume = loadInitial();
    initialized = true;
  }
}

export function getMasterVolume(): number {
  ensureInitialized();
  return volume;
}

export function setMasterVolume(v: number) {
  ensureInitialized();
  volume = clamp(v);
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, String(volume));
  listeners.forEach((fn) => fn(volume));
}

// Fires on every change, including ones made from elsewhere (e.g. a clip
// already playing while the user drags the slider).
export function subscribeMasterVolume(fn: (v: number) => void): () => void {
  ensureInitialized();
  listeners.add(fn);
  return () => listeners.delete(fn);
}
