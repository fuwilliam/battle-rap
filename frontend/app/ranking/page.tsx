import { getRanking } from "@/lib/data";

export const dynamic = "force-dynamic";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

export default async function RankingPage() {
  const rows = await getRanking();

  return (
    <section className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">Ranking</h1>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-white/60">
            <tr>
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Artist</th>
              <th className="px-4 py-3 text-right font-medium">Monthly Listeners</th>
              <th className="px-4 py-3 text-right font-medium">Followers</th>
              <th className="px-4 py-3 text-right font-medium">Wins</th>
              <th className="px-4 py-3 text-right font-medium">Losses</th>
              <th className="px-4 py-3 text-right font-medium">Win Rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.artist_id}
                className="border-t border-white/5 transition hover:bg-white/5"
              >
                <td className="px-4 py-3 text-white/50">{i + 1}</td>
                <td className="px-4 py-3 font-medium">{r.artist_name}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(r.monthly_listeners)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(r.followers)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.wins}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.losses}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {(r.win_rate * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
