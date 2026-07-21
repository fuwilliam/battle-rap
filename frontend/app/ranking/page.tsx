import { getRanking } from "@/lib/data";

export const dynamic = "force-dynamic";

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export default async function RankingPage() {
  const rows = await getRanking();

  return (
    <section className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">Ranking</h1>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-white/60">
            <tr>
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Artist</th>
              <th className="px-4 py-3 text-right font-medium">Monthly Listeners</th>
              <th className="px-4 py-3 text-right font-medium">Wins</th>
              <th className="px-4 py-3 text-right font-medium">Losses</th>
              <th className="px-4 py-3 font-medium">Win Rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.artist_id}
                className="border-t border-white/5 transition hover:bg-white/5"
              >
                <td className="px-4 py-3 tabular-nums text-white/50">{i + 1}</td>
                <td className="px-4 py-3 font-medium">{r.artist_name}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {compact.format(r.monthly_listeners)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{r.wins}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.losses}</td>
                <td className="px-4 py-3">
                  {/* bar fills to win rate; hue shifts red -> green with the value */}
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
    </section>
  );
}
