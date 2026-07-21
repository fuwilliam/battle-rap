"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Matchup, Rapper, Track } from "@/lib/types";
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
function TrackEmbed({ trackId, title }: { trackId: string; title: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let controller: SpotifyController | undefined;
    let cancelled = false;

    getSpotifyIframeApi().then((API) => {
      if (cancelled || !ref.current) return;
      API.createController(
        ref.current,
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

    return () => {
      cancelled = true;
      try {
        controller?.destroy();
      } catch {}
    };
  }, [trackId]);

  return (
    <div ref={ref} title={title} className="min-h-20 w-full overflow-hidden rounded-xl" />
  );
}

function RapperCard({
  rapper,
  tracks,
  picked,
  dimmed,
  disabled,
  onPick,
}: {
  rapper: Rapper;
  tracks: Track[];
  picked: boolean;
  dimmed: boolean;
  disabled: boolean;
  onPick: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const busHandle = useRef<Pausable>({ pause: () => {} });

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
    fadeTo(0, () => el.pause());
  }, [fadeTo]);

  const startPreview = useCallback(() => {
    const el = audioRef.current;
    if (!el || !rapper.preview_url) return;
    audioBus.claim(busHandle.current); // pause any playing track/clip first
    el.currentTime = 0;
    el.volume = 0;
    el.play().then(() => fadeTo(0.85)).catch(() => {}); // ignore autoplay blocks
  }, [rapper.preview_url, fadeTo]);

  // the bus pauses the hover clip by calling this handle
  useEffect(() => {
    busHandle.current.pause = stopPreview;
  }, [stopPreview]);

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
        {tracks.map((t) => (
          <TrackEmbed key={t.track_id} trackId={t.track_id} title={t.track_name} />
        ))}
      </div>
    </div>
  );
}

export function VoteArena({ initial }: { initial: Matchup }) {
  const [matchup, setMatchup] = useState<Matchup>(initial);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // the next matchup, fetched in the background so voting swaps instantly
  const nextRef = useRef<Promise<Matchup | null> | null>(null);

  const prefetch = useCallback(() => {
    nextRef.current = fetch("/api/matchup", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Matchup>) : null))
      .catch(() => null);
  }, []);

  useEffect(() => {
    prefetch();
  }, [prefetch]);

  async function vote(winner: Rapper, loser: Rapper) {
    if (busy) return;
    setBusy(true);
    setPicked(winner.artist_id);

    // fire-and-forget the vote — don't make the user wait on the write
    fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winner_id: winner.artist_id, loser_id: loser.artist_id }),
    }).catch(() => {});

    // short beat so the pick animation reads
    await new Promise((r) => setTimeout(r, 350));

    let next = await (nextRef.current ?? Promise.resolve(null));
    if (!next) {
      next = await fetch("/api/matchup", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
    }
    if (next) setMatchup(next);
    prefetch(); // queue the following matchup

    setPicked(null);
    setBusy(false);
  }

  const { rapper1, rapper2, tracks1, tracks2 } = matchup;

  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4 sm:gap-6">
        <RapperCard
          rapper={rapper1}
          tracks={tracks1}
          picked={picked === rapper1.artist_id}
          dimmed={picked !== null && picked !== rapper1.artist_id}
          disabled={busy}
          onPick={() => vote(rapper1, rapper2)}
        />
        <div className="self-center pt-24 text-2xl font-bold text-white/50">vs</div>
        <RapperCard
          rapper={rapper2}
          tracks={tracks2}
          picked={picked === rapper2.artist_id}
          dimmed={picked !== null && picked !== rapper2.artist_id}
          disabled={busy}
          onPick={() => vote(rapper2, rapper1)}
        />
      </div>
      <p className="mt-8 text-center text-sm text-white/40">
        Tap a rapper to vote — or hover for a taste. Top tracks preview below each.
      </p>
    </section>
  );
}
