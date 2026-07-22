"use client";

import { useEffect, useReducer, useState } from "react";
import type { SeedEntry, Track } from "@/lib/types";
import { pairEntrants, roundLabel } from "@/lib/bracket";
import { RapperCard } from "@/components/RapperCard";

type Match = {
  a: SeedEntry;
  b: SeedEntry;
  tracksA?: Track[];
  previewA?: string | null;
  tracksB?: Track[];
  previewB?: string | null;
  winner?: string; // artist_id
};

type BracketState = { rounds: Match[][] };

type Action =
  | {
      type: "setTracks";
      roundIdx: number;
      matchIdx: number;
      tracksA: Track[];
      previewA: string | null;
      tracksB: Track[];
      previewB: string | null;
    }
  | { type: "pickWinner"; roundIdx: number; matchIdx: number; winnerId: string };

function reducer(state: BracketState, action: Action): BracketState {
  if (action.type === "setTracks") {
    return {
      rounds: state.rounds.map((round, ri) =>
        ri !== action.roundIdx
          ? round
          : round.map((m, mi) =>
              mi !== action.matchIdx
                ? m
                : {
                    ...m,
                    tracksA: action.tracksA,
                    previewA: action.previewA,
                    tracksB: action.tracksB,
                    previewB: action.previewB,
                  },
            ),
      ),
    };
  }

  // pickWinner
  const rounds = state.rounds.map((round, ri) =>
    ri !== action.roundIdx
      ? round
      : round.map((m, mi) => (mi !== action.matchIdx ? m : { ...m, winner: action.winnerId })),
  );

  const decidedRound = rounds[action.roundIdx];
  const roundComplete = decidedRound.every((m) => m.winner);
  if (roundComplete && decidedRound.length > 1) {
    const winners = decidedRound.map((m) => (m.winner === m.a.artist_id ? m.a : m.b));
    const nextRound: Match[] = [];
    for (let i = 0; i < winners.length; i += 2) {
      nextRound.push({ a: winners[i], b: winners[i + 1] });
    }
    rounds.push(nextRound);
  }

  return { rounds };
}

// First not-yet-decided match, in play order. `null` once the final is decided.
function findCurrent(rounds: Match[][]): { roundIdx: number; matchIdx: number } | null {
  for (let ri = 0; ri < rounds.length; ri++) {
    const matchIdx = rounds[ri].findIndex((m) => !m.winner);
    if (matchIdx !== -1) return { roundIdx: ri, matchIdx };
  }
  return null;
}

async function fetchTracks(idA: string, idB: string) {
  const res = await fetch(`/api/bracket/tracks?a=${idA}&b=${idB}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json() as Promise<{
    tracksA: Track[];
    previewA: string | null;
    tracksB: Track[];
    previewB: string | null;
  }>;
}

export function BracketArena({
  entrants,
  onPlayAgain,
}: {
  entrants: SeedEntry[];
  onPlayAgain: () => void;
}) {
  const [state, dispatch] = useReducer(reducer, entrants, (seeded): BracketState => ({
    rounds: [pairEntrants(seeded).map(([a, b]) => ({ a, b }))],
  }));
  const [picked, setPicked] = useState<string | null>(null);
  // one id per playthrough, so every pick in this bracket groups together
  const [runId] = useState(() => crypto.randomUUID());

  const current = findCurrent(state.rounds);
  const currentMatch = current ? state.rounds[current.roundIdx][current.matchIdx] : null;
  const finalRound = state.rounds[state.rounds.length - 1];
  const champion =
    !current && finalRound.length === 1 && finalRound[0].winner
      ? finalRound[0].winner === finalRound[0].a.artist_id
        ? finalRound[0].a
        : finalRound[0].b
      : null;

  // Load tracks for the current match (and prefetch the next one in this
  // round) on demand -- fetching every entrant's preview up front risks
  // tripping Spotify's embed throttle (see lib/data.ts pairTracks).
  useEffect(() => {
    if (!current) return;
    const round = state.rounds[current.roundIdx];

    [current.matchIdx, current.matchIdx + 1].forEach((matchIdx) => {
      const match = round[matchIdx];
      if (!match || match.tracksA) return;
      fetchTracks(match.a.artist_id, match.b.artist_id).then((data) => {
        if (!data) return;
        dispatch({
          type: "setTracks",
          roundIdx: current.roundIdx,
          matchIdx,
          ...data,
        });
      });
    });
  }, [current, state.rounds]);

  async function pick(winnerId: string, loserId: string) {
    if (!current || picked) return;
    setPicked(winnerId);

    const matchesInRound = state.rounds[current.roundIdx].length;
    fetch("/api/bracket/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        run_id: runId,
        matches_in_round: matchesInRound,
        winner_id: winnerId,
        loser_id: loserId,
      }),
    }).catch(() => {});

    await new Promise((r) => setTimeout(r, 350)); // let the pick animation read

    dispatch({ type: "pickWinner", roundIdx: current.roundIdx, matchIdx: current.matchIdx, winnerId });
    setPicked(null);
  }

  if (champion) {
    return (
      <section className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="mb-4 text-sm uppercase tracking-widest text-accent">Champion</p>
        <div className="animate-crown">
          <RapperCard
            rapper={champion}
            tracks={[]}
            picked
            dimmed={false}
            disabled
            onPick={() => {}}
          />
        </div>
        <button
          type="button"
          onClick={onPlayAgain}
          className="mt-8 rounded-full border border-accent/60 px-6 py-2 text-sm font-semibold text-accent transition hover:bg-accent hover:text-black"
        >
          Play again
        </button>
      </section>
    );
  }

  if (!current || !currentMatch) return null;

  const remainingMatches = state.rounds[current.roundIdx].length;

  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <p className="mb-6 text-center text-sm uppercase tracking-widest text-white/50">
        {roundLabel(remainingMatches)} · #{currentMatch.a.seed} vs #{currentMatch.b.seed}
      </p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4 sm:gap-6">
        <RapperCard
          rapper={{ ...currentMatch.a, preview_url: currentMatch.previewA ?? null }}
          tracks={currentMatch.tracksA ?? []}
          picked={picked === currentMatch.a.artist_id}
          dimmed={picked !== null && picked !== currentMatch.a.artist_id}
          disabled={picked !== null}
          onPick={() => pick(currentMatch.a.artist_id, currentMatch.b.artist_id)}
        />
        <div className="self-center pt-24 text-2xl font-bold text-white/50">vs</div>
        <RapperCard
          rapper={{ ...currentMatch.b, preview_url: currentMatch.previewB ?? null }}
          tracks={currentMatch.tracksB ?? []}
          picked={picked === currentMatch.b.artist_id}
          dimmed={picked !== null && picked !== currentMatch.b.artist_id}
          disabled={picked !== null}
          onPick={() => pick(currentMatch.b.artist_id, currentMatch.a.artist_id)}
        />
      </div>
    </section>
  );
}
