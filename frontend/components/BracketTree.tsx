import type { SeedEntry } from "@/lib/types";
import { roundLabel } from "@/lib/bracket";

type TreeMatch = { a: SeedEntry; b: SeedEntry; winner?: string };

const BOX_W = 200;
const BOX_H = 60;
const ROW_GAP = 14; // vertical gap between adjacent round-0 boxes
const COL_GAP = 48; // horizontal space between columns, reserved for connectors
const COL_W = BOX_W + COL_GAP;
const LABEL_H = 28;
const LINE_COLOR = "rgba(255,255,255,0.15)";

function Slot({ entry, won }: { entry: SeedEntry; won: boolean }) {
  return (
    <div className={`flex h-[30px] items-center gap-2 px-2 ${won ? "" : "opacity-40"}`}>
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

// A match's vertical center is always the midpoint of its two children's
// centers -- computing it this way (rather than relying on flexbox spacing
// per column) is what actually guarantees correct alignment at every round,
// including the final.
function matchCenters(rounds: TreeMatch[][]): number[][] {
  const centers: number[][] = [rounds[0].map((_, i) => i * (BOX_H + ROW_GAP) + BOX_H / 2)];
  for (let r = 1; r < rounds.length; r++) {
    centers.push(rounds[r].map((_, i) => (centers[r - 1][2 * i] + centers[r - 1][2 * i + 1]) / 2));
  }
  return centers;
}

function Line({ left, top, width, height }: { left: number; top: number; width: number; height: number }) {
  return (
    <div className="absolute" style={{ left, top, width, height, background: LINE_COLOR }} />
  );
}

// Simple March-Madness-style bracket: one column per round, elbow connectors
// linking each pair of matches to the next round's match, with every match
// centered exactly on the midpoint of the two matches feeding into it.
export function BracketTree({ rounds }: { rounds: TreeMatch[][] }) {
  if (rounds.length === 0 || rounds[0].length === 0) return null;

  const centers = matchCenters(rounds);
  const totalHeight = Math.max(...centers[0]) + BOX_H / 2;
  const totalWidth = rounds.length * COL_W - COL_GAP;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="relative mx-auto" style={{ width: totalWidth, height: totalHeight + LABEL_H }}>
        {rounds.map((round, r) => (
          <p
            key={`label-${r}`}
            className="absolute top-0 text-center text-xs uppercase tracking-widest text-white/40"
            style={{ left: r * COL_W, width: BOX_W }}
          >
            {roundLabel(round.length)}
          </p>
        ))}

        {rounds.slice(1).map((round, ri) => {
          const r = ri + 1;
          const xLeft = (r - 1) * COL_W + BOX_W;
          const xMid = xLeft + COL_GAP / 2;
          return round.map((_, i) => {
            const yTop = centers[r - 1][2 * i];
            const yBot = centers[r - 1][2 * i + 1];
            const yMid = centers[r][i];
            return (
              <div key={`conn-${r}-${i}`}>
                <Line left={xLeft} top={LABEL_H + yTop} width={COL_GAP / 2} height={1} />
                <Line left={xLeft} top={LABEL_H + yBot} width={COL_GAP / 2} height={1} />
                <Line left={xMid} top={LABEL_H + Math.min(yTop, yBot)} width={1} height={Math.abs(yBot - yTop)} />
                <Line left={xMid} top={LABEL_H + yMid} width={COL_GAP / 2} height={1} />
              </div>
            );
          });
        })}

        {rounds.map((round, r) =>
          round.map((m, i) => (
            <div
              key={`box-${r}-${i}`}
              className="absolute flex flex-col justify-center rounded-lg border border-white/10 bg-white/[0.03]"
              style={{ left: r * COL_W, top: LABEL_H + centers[r][i] - BOX_H / 2, width: BOX_W, height: BOX_H }}
            >
              <Slot entry={m.a} won={m.winner === m.a.artist_id} />
              <Slot entry={m.b} won={m.winner === m.b.artist_id} />
            </div>
          )),
        )}
      </div>
    </div>
  );
}
