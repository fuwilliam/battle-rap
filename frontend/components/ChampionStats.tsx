"use client";

import { useEffect, useState } from "react";
import type { BracketRankingRow } from "@/lib/types";

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 py-3 last:border-0">
      <span className="text-sm text-white/60">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}

// Bracket record for the champion, fetched once the run is decided -- same
// stats/visual language as BracketRankingTable (🏆 count, colored win-rate
// bar) but as a single-artist tile next to the champion's picture.
export function ChampionStats({ artistId }: { artistId: string }) {
  const [stats, setStats] = useState<BracketRankingRow | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/bracket/artist-stats?artistId=${artistId}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setStats(data?.stats ?? null);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, [artistId]);

  if (stats === undefined) {
    return (
      <div className="w-full max-w-xs animate-pulse rounded-2xl border border-white/10 p-6 text-sm text-white/40">
        Loading bracket record…
      </div>
    );
  }

  if (!stats) return null;

  const winRatePct = Math.round(stats.win_rate * 100);

  return (
    <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-left">
      <p className="mb-2 text-xs uppercase tracking-widest text-white/40">Bracket record</p>
      <StatRow label="🏆 Championships" value={stats.championships} />
      <StatRow label="Final Fours" value={stats.final_fours} />
      <StatRow label="W/L" value={`${stats.wins}/${stats.losses}`} />
      <div className="pt-3">
        <div className="mb-1 flex items-center justify-between text-sm text-white/60">
          <span>Win Rate</span>
          <span className="font-semibold tabular-nums text-white">{winRatePct}%</span>
        </div>
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${winRatePct}%`,
              backgroundColor: `hsl(${stats.win_rate * 120} 65% 45%)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
