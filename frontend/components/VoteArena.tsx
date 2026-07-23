"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Matchup, Rapper } from "@/lib/types";
import { RapperCard } from "@/components/RapperCard";

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
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-4 sm:gap-6">
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
        Tap to vote, hover for a taste
      </p>
    </section>
  );
}
