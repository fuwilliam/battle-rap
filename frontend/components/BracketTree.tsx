import type { SeedEntry } from "@/lib/types";
import { roundLabel } from "@/lib/bracket";

type TreeMatch = { a: SeedEntry; b: SeedEntry; winner?: string };

function Slot({ entry, won }: { entry: SeedEntry; won: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-2 py-1 ${won ? "" : "opacity-40"}`}>
      <span className="w-4 shrink-0 text-right text-[11px] text-white/40">{entry.seed}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={entry.image_url ?? ""}
        alt={entry.artist_name}
        className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-white/10"
      />
      <span className={`truncate text-sm ${won ? "font-semibold text-white" : "text-white/50"}`}>
        {entry.artist_name}
      </span>
    </div>
  );
}

// Simple March-Madness-style bracket: one column per round, matches spaced
// out more in later rounds so the columns loosely converge toward the champion.
export function BracketTree({ rounds }: { rounds: TreeMatch[][] }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {rounds.map((round, ri) => (
        <div
          key={ri}
          className="flex min-w-[170px] flex-1 flex-col justify-around gap-3"
        >
          <p className="text-center text-xs uppercase tracking-widest text-white/40">
            {roundLabel(round.length)}
          </p>
          {round.map((m, mi) => (
            <div key={mi} className="rounded-lg border border-white/10 bg-white/[0.03] py-1">
              <Slot entry={m.a} won={m.winner === m.a.artist_id} />
              <Slot entry={m.b} won={m.winner === m.b.artist_id} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
