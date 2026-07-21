"use client";

import { useMemo, useState } from "react";
import type { RankingRow } from "@/lib/types";

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const MEDALS = ["🥇", "🥈", "🥉"];
const PAGE = 50;

type SortKey = "monthly_listeners" | "wins" | "losses" | "win_rate";

const COLS: { key: SortKey; label: string }[] = [
  { key: "monthly_listeners", label: "Monthly Listeners" },
  { key: "wins", label: "Wins" },
  { key: "losses", label: "Losses" },
  { key: "win_rate", label: "Win Rate" },
];

export function RankingTable({ rows }: { rows: RankingRow[] }) {
  // canonical battle rank from the incoming (win_rate desc, wins desc) order;
  // it stays glued to each artist even when the view is re-sorted
  const ranked = useMemo(() => rows.map((r, i) => ({ ...r, rank: i + 1 })), [rows]);

  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(() => {
    if (!sortKey) return ranked;
    return [...ranked].sort(
      (a, b) => (a[sortKey] - b[sortKey]) * (dir === "asc" ? 1 : -1),
    );
  }, [ranked, sortKey, dir]);

  const visible = expanded ? sorted : sorted.slice(0, PAGE);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setDir("desc");
    }
  }

  const arrow = (k: SortKey) => (sortKey === k ? (dir === "asc" ? " ▲" : " ▼") : "");

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-white/60">
            <tr>
              <th className="w-12 px-4 py-3 text-center font-medium">#</th>
              <th className="px-4 py-3 font-medium">Artist</th>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  className={`px-4 py-3 font-medium ${c.key === "win_rate" ? "" : "text-right"}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(c.key)}
                    className="tabular-nums transition hover:text-white"
                  >
                    {c.label}
                    {arrow(c.key)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr
                key={r.artist_id}
                className={`border-t border-white/5 transition hover:bg-white/5 ${
                  r.rank <= 3 ? "bg-accent/[0.04]" : ""
                }`}
              >
                <td className="px-4 py-3 text-center text-lg tabular-nums text-white/50">
                  {r.rank <= 3 ? MEDALS[r.rank - 1] : r.rank}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.image_url ?? ""}
                      alt={r.artist_name}
                      className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/10"
                    />
                    <span className="font-medium">{r.artist_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {compact.format(r.monthly_listeners)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{r.wins}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.losses}</td>
                <td className="px-4 py-3">
                  <div className="relative h-6 w-28 overflow-hidden rounded-md bg-white/5">
                    <div
                      className="absolute inset-y-0 left-0"
                      style={{
                        width: `${r.win_rate * 100}%`,
                        backgroundColor: `hsl(${r.win_rate * 120} 65% 45% / 0.55)`,
                      }}
                    />
                    <span className="absolute inset-0 grid place-items-center text-xs font-semibold tabular-nums">
                      {(r.win_rate * 100).toFixed(0)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sorted.length > PAGE && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            {expanded ? "Show top 50" : `Show all ${sorted.length}`}
          </button>
        </div>
      )}
    </>
  );
}
