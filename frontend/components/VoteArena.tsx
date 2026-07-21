"use client";

import { useState } from "react";
import type { Matchup, Rapper, Track } from "@/lib/types";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
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
  return (
    <div className={`flex flex-col gap-3 transition duration-300 ${dimmed ? "opacity-40" : "opacity-100"}`}>
      <button
        type="button"
        onClick={onPick}
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
          <p className="text-sm text-white/70">{fmt(rapper.monthly_listeners)} monthly listeners</p>
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
          <iframe
            key={t.track_id}
            src={t.track_url}
            title={t.track_name}
            height={80}
            className="w-full rounded-xl"
            frameBorder={0}
            loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          />
        ))}
      </div>
    </div>
  );
}

export function VoteArena({ initial }: { initial: Matchup }) {
  const [matchup, setMatchup] = useState<Matchup>(initial);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function vote(winner: Rapper, loser: Rapper) {
    if (busy) return;
    setBusy(true);
    setPicked(winner.artist_id);

    try {
      await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winner_id: winner.artist_id, loser_id: loser.artist_id }),
      });
      // brief beat so the pick animation reads before swapping
      await new Promise((r) => setTimeout(r, 450));
      const next = await fetch("/api/matchup", { cache: "no-store" });
      if (!next.ok) throw new Error("matchup fetch failed");
      setMatchup((await next.json()) as Matchup);
    } catch (err) {
      console.error(err);
    } finally {
      setPicked(null);
      setBusy(false);
    }
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
        Tap a rapper to cast your vote. Preview their top tracks below each.
      </p>
    </section>
  );
}
