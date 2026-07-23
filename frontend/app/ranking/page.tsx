import { getBracketRanking, getRanking } from "@/lib/data";
import { RankingTabs } from "@/components/RankingTabs";

export const dynamic = "force-dynamic";

export default async function RankingPage() {
  const [headToHead, bracket] = await Promise.all([getRanking(), getBracketRanking()]);

  return (
    <section className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">Ranking</h1>
      <RankingTabs headToHead={headToHead} bracket={bracket} />
    </section>
  );
}
