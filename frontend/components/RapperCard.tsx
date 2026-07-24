"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { Rapper, Track } from "@/lib/types";
import { useHoverPreview } from "@/lib/useHoverPreview";

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

// Always shows exactly 1 decimal (e.g. "1.0B", not "1B") so the stream
// count doesn't jump between digit counts as it crosses round numbers.
const streamsFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

// Marquee timing: constant px/sec so long track names don't scroll faster
// than short ones, plus a pause before scrolling starts so the user has
// time to read the beginning of the text.
const MARQUEE_SPEED_PX_PER_SEC = 40;
const MARQUEE_START_DELAY_S = 1;

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
      <div className="flex shrink-0 flex-col items-end gap-0.5 text-xs">
        {track.playcount != null && (
          <span className="font-semibold text-white/80">{streamsFormat.format(track.playcount)}</span>
        )}
        <span className="text-white/50">{formatDuration(track.duration_ms)}</span>
      </div>
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
  const [marquee, setMarquee] = useState<{ overflowing: boolean; duration: number }>({
    overflowing: false,
    duration: 0,
  });

  // Only scroll the "now playing" pill when the track/credit text is
  // actually wider than the pill -- short names shouldn't animate at all.
  // Duration is derived from the text's actual pixel width so every track
  // scrolls at the same constant speed instead of long names racing by
  // faster than short ones.
  // marqueeTextRef always wraps a single, non-duplicated copy of the label
  // (see the JSX below) so this measurement stays accurate regardless of
  // whether the looping second copy is currently being rendered.
  useLayoutEffect(() => {
    if (!isPlaying || !rapper.preview_track_name) return;
    const text = marqueeTextRef.current;
    const container = marqueeContainerRef.current;
    if (!text || !container) return;

    const overflowing = text.scrollWidth > container.clientWidth;
    const duration = text.scrollWidth / MARQUEE_SPEED_PX_PER_SEC;
    setMarquee({ overflowing, duration });
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
                className={`inline-flex items-center whitespace-nowrap ${marquee.overflowing ? "animate-marquee" : ""}`}
                style={
                  marquee.overflowing
                    ? {
                        animationDuration: `${marquee.duration}s`,
                        animationDelay: `${MARQUEE_START_DELAY_S}s`,
                      }
                    : undefined
                }
              >
                <span ref={marqueeTextRef}>
                  {rapper.preview_track_name} — {rapper.preview_credit ?? rapper.artist_name}
                </span>
                {marquee.overflowing && (
                  <>
                    <span className="mx-2" aria-hidden="true">
                      •
                    </span>
                    <span aria-hidden="true">
                      {rapper.preview_track_name} — {rapper.preview_credit ?? rapper.artist_name}
                    </span>
                    <span className="mx-2" aria-hidden="true">
                      •
                    </span>
                  </>
                )}
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