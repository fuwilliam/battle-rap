import { recordBracketVote } from "@/lib/data";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const runId = body?.run_id;
    const matchesInRound = body?.matches_in_round;
    const winnerId = body?.winner_id;
    const loserId = body?.loser_id;

    if (
      typeof runId !== "string" ||
      typeof matchesInRound !== "number" ||
      typeof winnerId !== "string" ||
      typeof loserId !== "string" ||
      winnerId === loserId
    ) {
      return Response.json({ error: "Invalid bracket vote payload" }, { status: 400 });
    }

    await recordBracketVote(runId, matchesInRound, winnerId, loserId);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("POST /api/bracket/vote failed:", err);
    return Response.json({ error: "Failed to record bracket vote" }, { status: 500 });
  }
}
