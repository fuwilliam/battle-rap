import { getRanking } from "@/lib/data";
import { RankingTable } from "@/components/RankingTable";

export const dynamic = "force-dynamic";

export default async function RankingPage() {
  const rows = await getRanking();

  return (
    <section className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">Ranking</h1>
      <RankingTable rows={rows} />
    </section>
  );
}
