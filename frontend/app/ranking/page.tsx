import { getRanking } from "@/lib/data";
import { RankingTable } from "@/components/RankingTable";

export const dynamic = "force-dynamic";

export default async function RankingPage() {
  const rows = await getRanking();

  return (
    <section className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold">Ranking</h1>
      <p className="mb-6 text-sm text-white/50">
        Only artists with at least 5 matchups are ranked, so a lone 1–0 doesn&apos;t
        top the board at 100%.
      </p>
      <RankingTable rows={rows} />
    </section>
  );
}
