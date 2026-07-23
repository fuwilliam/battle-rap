"use client";

import { useState } from "react";
import type { BracketMode, SeedEntry } from "@/lib/types";

const SIZES = [16, 32, 64] as const;

const MODES: { key: BracketMode; label: string; description: string }[] = [
  {
    key: "major_league",
    label: "Ranked",
    description:
      "Seeded by proven win rate and popularity, with a few wildcard slots and some shuffling for variety.",
  },
  {
    key: "random",
    label: "Random",
    description: "No seeding at all -- a genuinely random draw from the eligible pool every time.",
  },
];

export function BracketSizePicker({
  onReady,
}: {
  onReady: (entrants: SeedEntry[]) => void;
}) {
  const [mode, setMode] = useState<BracketMode>("major_league");
  const [loadingSize, setLoadingSize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeMode = MODES.find((m) => m.key === mode) ?? MODES[0];

  async function pick(size: number) {
    setLoadingSize(size);
    setError(null);
    try {
      const res = await fetch(`/api/bracket?size=${size}&mode=${mode}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to build bracket");
      onReady(data.entrants);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build bracket");
      setLoadingSize(null);
    }
  }

  return (
    <section className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-3xl font-bold">Bracket Mode</h1>
      <p className="mt-2 text-white/60">Pick a field size and crown a champion.</p>

      <div className="mt-8 flex justify-center gap-2">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMode(m.key)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              mode === m.key
                ? "border-accent bg-accent/10 text-accent"
                : "border-white/10 text-white/60 hover:text-white"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-white/50">{activeMode.description}</p>

      <div className="mt-6 flex justify-center gap-4">
        {SIZES.map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => pick(size)}
            disabled={loadingSize !== null}
            className="rounded-2xl border border-white/10 px-6 py-4 text-lg font-semibold transition
              enabled:hover:border-accent enabled:hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingSize === size ? "Loading…" : size}
          </button>
        ))}
      </div>

      {mode === "major_league" && (
        <p className="mt-4 inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs text-accent/80">
          <span aria-hidden="true">ⓘ</span>
          Bored of the same matchups? Discover new artists in Random mode!
        </p>
      )}

      {error && <p className="mt-6 text-sm text-red-400">{error}</p>}
    </section>
  );
}
