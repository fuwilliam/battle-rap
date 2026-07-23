"use client";

// Some Spotify preview clips are mastered noticeably louder than others, so
// the fade-in's fixed target volume (see useHoverPreview) lands at wildly
// different perceived loudness per track. This routes every preview <audio>
// element through one shared Web Audio graph with a DynamicsCompressorNode
// tuned as a limiter, so loud peaks get clamped down automatically.
let ctx: AudioContext | null = null;
let limiter: DynamicsCompressorNode | null = null;
const connected = new WeakSet<HTMLAudioElement>();

function getContext(): { context: AudioContext; limiter: DynamicsCompressorNode } | null {
  if (typeof window === "undefined") return null;
  if (!ctx || !limiter) {
    ctx = new AudioContext();
    limiter = ctx.createDynamicsCompressor();
    // Near-limiter settings: leave normally-mastered clips alone, clamp the
    // ones that come in hot. Short attack so it reacts before a peak clips.
    limiter.threshold.value = -6;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    limiter.connect(ctx.destination);
  }
  return { context: ctx, limiter };
}

// Call right before playback starts. Needs a user gesture to resume a
// suspended context, and only ever wires up a given element once --
// createMediaElementSource throws if called twice on the same element.
export function connectToLimiter(audioEl: HTMLAudioElement) {
  const graph = getContext();
  if (!graph) return;
  const { context, limiter: node } = graph;
  if (context.state === "suspended") context.resume().catch(() => {});
  if (connected.has(audioEl)) return;
  connected.add(audioEl);
  context.createMediaElementSource(audioEl).connect(node);
}
