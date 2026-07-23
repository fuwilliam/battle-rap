"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Rapper, Track } from "@/lib/types";
import {
  audioBus,
  getSpotifyIframeApi,
  type Pausable,
  type SpotifyController,
} from "@/lib/spotifyEmbed";

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

// Spotify track embed via the iFrame API, so its playback can be paused
// programmatically and coordinated through the audio bus.
export function TrackEmbed({
  trackId,
  title,
  index,
}: {
  trackId: string;
  title: string;
  index: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // createController REPLACES the element it's given with an iframe. If we
    // hand it the React-rendered node, React later can't find that node to
    // unmount it (removeChild throws -> the page's error boundary). So mount
    // into a throwaway child we own; React only ever removes `host`.
    const mount = document.createElement("div");
    host.appendChild(mount);

    let controller: SpotifyController | undefined;
    let cancelled = false;

    // Stagger creation: firing every embed's controller at once trips
    // Spotify's embed throttle ("upstream request timeout"). Space them out.
    const timer = setTimeout(() => {
      getSpotifyIframeApi().then((API) => {
        if (cancelled) return;
        API.createController(
          mount,
          { uri: `spotify:track:${trackId}`, width: "100%", height: 80 },
          (ctrl) => {
            controller = ctrl;
            const handle: Pausable = { pause: () => ctrl.pause() };
            ctrl.addListener("playback_update", (e) => {
              if (!e.data.isPaused) audioBus.claim(handle);
              else audioBus.release(handle);
            });
          },
        );
      });
    }, index * 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      try {
        controller?.destroy();
      } catch {}
    };
  }, [trackId, index]);

  return (
    <div ref={hostRef} title={title} className="min-h-20 w-full overflow-hidden rounded-xl" />
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const busHandle = useRef<Pausable>({ pause: () => {} });
  const [isPlaying, setIsPlaying] = useState(false);

  const fadeTo = useCallback((target: number, onDone?: () => void) => {
    const el = audioRef.current;
    if (!el) return;
    if (fadeRef.current) clearInterval(fadeRef.current);
    fadeRef.current = setInterval(() => {
      const step = 0.08;
      if (Math.abs(el.volume - target) <= step) {
        el.volume = target;
        if (fadeRef.current) clearInterval(fadeRef.current);
        onDone?.();
      } else {
        el.volume += el.volume < target ? step : -step;
      }
    }, 40);
  }, []);

  const stopPreview = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    audioBus.release(busHandle.current);
    setIsPlaying(false);
    fadeTo(0, () => el.pause());
  }, [fadeTo]);

  const startPreview = useCallback(() => {
    const el = audioRef.current;
    if (!el || !rapper.preview_url) return;
    audioBus.claim(busHandle.current); // pause any playing track/clip first
    el.currentTime = 0;
    el.volume = 0;
    el
      .play()
      .then(() => {
        setIsPlaying(true);
        fadeTo(0.85);
      })
      .catch(() => {}); // ignore autoplay blocks
  }, [rapper.preview_url, fadeTo]);

  // the bus pauses the hover clip by calling this handle
  useEffect(() => {
    busHandle.current.pause = stopPreview;
  }, [stopPreview]);

  // e.g. the bracket champion screen -- plays without waiting for a hover.
  // Relies on the "sticky" user-activation the page already has from the
  // click that got here, so browsers don't block the programmatic play().
  useEffect(() => {
    if (!autoplay) return;
    startPreview();
    return stopPreview;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, rapper.artist_id]);

  useEffect(
    () => () => {
      if (fadeRef.current) clearInterval(fadeRef.current);
      audioRef.current?.pause();
    },
    [],
  );

  return (
    <div
      className={`flex flex-col gap-3 transition duration-300 ${dimmed ? "opacity-40" : "opacity-100"}`}
    >
      {rapper.preview_url && (
        <audio ref={audioRef} src={rapper.preview_url} preload="none" />
      )}
      <button
        type="button"
        onClick={onPick}
        onMouseEnter={startPreview}
        onMouseLeave={stopPreview}
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
            <span className="flex min-w-0 flex-1 justify-end overflow-hidden whitespace-nowrap">
              <span className="inline-block animate-marquee whitespace-nowrap">
                {rapper.preview_track_name} — {rapper.artist_name}
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

      <div className="flex flex-col gap-2">
        {tracks.map((t, i) => (
          <TrackEmbed
            key={t.track_id}
            trackId={t.track_id}
            title={t.track_name}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}
