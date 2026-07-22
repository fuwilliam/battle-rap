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
const PATH_COLOR = "#22c55e";
const PATH_GLOW = "0 0 6px rgba(34,197,94,0.85)";

function Slot({ entry, won, champion }: { entry: SeedEntry; won: boolean; champion: boolean }) {
  return (
    <div className={`flex h-[30px] items-center gap-2 px-2 ${won ? "" : "opacity-40"}`}>
      <span className="w-4 shrink-0 text-right text-[11px] text-white/40">{entry.seed}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={entry.image_url ?? ""}
        alt={entry.artist_name}
        className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-white/10"
      />
      <span
        className={`truncate text-sm ${
          champion
            ? "rounded px-1.5 py-0.5 font-semibold text-black"
            : won
              ? "font-semibold text-white"
              : "text-white/50"
        }`}
        style={champion ? { background: "#facc15", boxShadow: "0 0 10px rgba(250,204,21,0.6)" } : undefined}
      >
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

// Which match index the champion occupies in each round, walking backward
// from the final (always index 0) to figure out which of the two child slots
// (2i or 2i+1) they came from at every earlier round.
function championIndexByRound(rounds: TreeMatch[][], championId: string | undefined): number[] {
  const idx = new Array(rounds.length).fill(-1);
  if (!championId) return idx;
  idx[rounds.length - 1] = 0;
  for (let r = rounds.length - 1; r > 0; r--) {
    const topChildIdx = 2 * idx[r];
    const topChild = rounds[r - 1][topChildIdx];
    const championWasTop = topChild.a.artist_id === championId || topChild.b.artist_id === championId;
    idx[r - 1] = championWasTop ? topChildIdx : topChildIdx + 1;
  }
  return idx;
}

function Line({
  left,
  top,
  width,
  height,
  onPath,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
  onPath: boolean;
}) {
  return (
    <div
      className="absolute"
      style={{
        left,
        top,
        width,
        height,
        background: onPath ? PATH_COLOR : LINE_COLOR,
        boxShadow: onPath ? PATH_GLOW : undefined,
      }}
    />
  );
}

// Simple March-Madness-style bracket: one column per round, elbow connectors
// linking each pair of matches to the next round's match, with every match
// centered exactly on the midpoint of the two matches feeding into it. The
// champion's own name and the exact path of matches they won glow gold/green.
export function BracketTree({ rounds }: { rounds: TreeMatch[][] }) {
  if (rounds.length === 0 || rounds[0].length === 0) return null;

  const centers = matchCenters(rounds);
  const totalHeight = Math.max(...centers[0]) + BOX_H / 2;
  const totalWidth = rounds.length * COL_W - COL_GAP;

  const championId = rounds[rounds.length - 1][0]?.winner;
  const champIndex = championIndexByRound(rounds, championId);

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
            const topChildIdx = 2 * i;
            const botChildIdx = 2 * i + 1;
            const yTop = centers[r - 1][topChildIdx];
            const yBot = centers[r - 1][botChildIdx];
            const yMid = centers[r][i];
            const topOnPath = champIndex[r - 1] === topChildIdx;
            const botOnPath = champIndex[r - 1] === botChildIdx;
            const outOnPath = champIndex[r] === i;
            return (
              <div key={`conn-${r}-${i}`}>
                <Line left={xLeft} top={LABEL_H + yTop} width={COL_GAP / 2} height={1} onPath={topOnPath} />
                <Line left={xLeft} top={LABEL_H + yBot} width={COL_GAP / 2} height={1} onPath={botOnPath} />
                <Line
                  left={xMid}
                  top={LABEL_H + Math.min(yTop, yMid)}
                  width={1}
                  height={Math.abs(yMid - yTop)}
                  onPath={topOnPath}
                />
                <Line
                  left={xMid}
                  top={LABEL_H + Math.min(yMid, yBot)}
                  width={1}
                  height={Math.abs(yBot - yMid)}
                  onPath={botOnPath}
                />
                <Line left={xMid} top={LABEL_H + yMid} width={COL_GAP / 2} height={1} onPath={outOnPath} />
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
              <Slot
                entry={m.a}
                won={m.winner === m.a.artist_id}
                champion={!!championId && m.a.artist_id === championId}
              />
              <Slot
                entry={m.b}
                won={m.winner === m.b.artist_id}
                champion={!!championId && m.b.artist_id === championId}
              />
            </div>
          )),
        )}
      </div>
    </div>
  );
}
