import { getMatchup } from "@/lib/data";
import { VoteArena } from "@/components/VoteArena";

// Fresh random matchup on every request — never prerender/cache.
export const dynamic = "force-dynamic";

export default async function Home() {
  const initial = await getMatchup();
  return <VoteArena initial={initial} />;
}
