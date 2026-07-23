"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { Rapper, Track } from "@/lib/types";
import { useHoverPreview } from "@/lib/useHoverPreview";

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatDuration(ms: number | null): string {
  if (ms == null) return "";
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

// Native replacement for a Spotify <iframe> embed -- hover to play the
// track's own 30s preview clip (same audioBus-coordinated fade as the artist
// card image), styled after Spotify's own embed using the metadata scraped
// alongside the preview URL (art, duration, explicit flag, credit, tint).
function TrackRow({ track }: { track: Track }) {
  const { audioRef, isPlaying, start, stop } = useHoverPreview(track.preview_url);

  return (
    <div
      onMouseEnter={start}
      onMouseLeave={stop}
      className={`flex min-w-0 items-center gap-3 rounded-xl border p-2 transition duration-200 ${
        isPlaying ? "border-accent/60" : "border-transparent"
      }`}
      style={track.tint_color ? { backgroundColor: track.tint_color } : undefined}
    >
      {track.preview_url && <audio ref={audioRef} src={track.preview_url} preload="none" />}
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-white/10">
        {track.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.image_url} alt="" className="h-full w-full object-cover" />
        )}
        {isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm">
            ▶
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold">{track.track_name}</p>
          {track.is_explicit && (
            <span className="shrink-0 rounded bg-white/15 px-1 text-[10px] font-bold leading-tight">
              E
            </span>
          )}
        </div>
        {track.credit && <p className="truncate text-xs text-white/60">{track.credit}</p>}
      </div>
      <span className="shrink-0 text-xs text-white/60">{formatDuration(track.duration_ms)}</span>
    </div>
  );
}

export function RapperCard({
  rapper,
  tracks,
  picked,
  dimmed,
  disabled,
  onPick,
  autoplay = false,
}: {
  rapper: Rapper;
  tracks: Track[];
  picked: boolean;
  dimmed: boolean;
  disabled: boolean;
  onPick: () => void;
  autoplay?: boolean;
}) {
  const { audioRef, isPlaying, start, stop } = useHoverPreview(rapper.preview_url, autoplay);
  const marqueeTextRef = useRef<HTMLSpanElement>(null);
  const marqueeContainerRef = useRef<HTMLSpanElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  // Only scroll the "now playing" pill when the track/credit text is
  // actually wider than the pill -- short names shouldn't animate at all.
  // --marquee-enter (the pill's own width) tells the loop's re-entry point
  // in globals.css how far off-screen-right to jump to, so it doesn't
  // travel further than necessary before becoming visible again.
  useLayoutEffect(() => {
    if (!isPlaying || !rapper.preview_track_name) return;
    const text = marqueeTextRef.current;
    const container = marqueeContainerRef.current;
    if (!text || !container) return;
    const isOverflowing = text.scrollWidth > container.clientWidth;
    setOverflowing(isOverflowing);
    if (isOverflowing) {
      text.style.setProperty("--marquee-enter", `${container.clientWidth}px`);
    }
  }, [isPlaying, rapper.preview_track_name, rapper.preview_credit, rapper.artist_name]);

  return (
    <div
      className={`flex min-w-0 flex-col gap-3 transition duration-300 ${dimmed ? "opacity-40" : "opacity-100"}`}
    >
      {rapper.preview_url && <audio ref={audioRef} src={rapper.preview_url} preload="none" />}
      <button
        type="button"
        onClick={onPick}
        onMouseEnter={start}
        onMouseLeave={stop}
        disabled={disabled}
        className={`group relative aspect-square w-full overflow-hidden rounded-2xl border-2 transition duration-200
          ${picked ? "border-accent shadow-[0_0_40px_-8px_var(--accent)]" : "border-white/10"}
          enabled:hover:border-accent enabled:hover:-translate-y-1 disabled:cursor-not-allowed`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={rapper.image_url ?? ""}
          alt={rapper.artist_name}
          className="h-full w-full object-cover transition duration-300 group-enabled:group-hover:scale-105"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4 text-left">
          <h2 className="text-2xl font-bold leading-tight">{rapper.artist_name}</h2>
          <p className="text-sm text-white/70">
            {compact.format(rapper.monthly_listeners)} monthly listeners
          </p>
        </div>
        {isPlaying && rapper.preview_track_name && (
          <div className="absolute left-2 top-2 flex max-w-[55%] items-center gap-1.5 rounded-full border border-accent/60 bg-black/70 px-2.5 py-1 text-xs font-semibold backdrop-blur">
            <span className="inline-block shrink-0 animate-spin-slow leading-none">💿</span>
            <span
              ref={marqueeContainerRef}
              className="flex min-w-0 flex-1 justify-start overflow-hidden whitespace-nowrap"
            >
              <span
                ref={marqueeTextRef}
                className={`inline-block whitespace-nowrap ${overflowing ? "animate-marquee" : ""}`}
              >
                {rapper.preview_track_name} — {rapper.preview_credit ?? rapper.artist_name}
              </span>
            </span>
          </div>
        )}
        {rapper.world_rank != null && rapper.world_rank > 0 && (
          <div
            title={`#${rapper.world_rank} most-streamed artist on Spotify`}
            className="absolute right-2 top-2 rounded-full border border-accent/60 bg-black/70 px-2.5 py-1 text-xs font-semibold backdrop-blur"
          >
            🌍 #{rapper.world_rank}
          </div>
        )}
      </button>

      <div className="flex min-w-0 flex-col gap-2">
        {tracks.map((t) => (
          <TrackRow key={t.track_id} track={t} />
        ))}
      </div>
    </div>
  );
}
