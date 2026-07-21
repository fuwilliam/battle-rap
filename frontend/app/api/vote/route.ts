import { recordVote } from "@/lib/data";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const winnerId = body?.winner_id;
    const loserId = body?.loser_id;

    if (typeof winnerId !== "string" || typeof loserId !== "string" || winnerId === loserId) {
      return Response.json({ error: "Invalid winner_id/loser_id" }, { status: 400 });
    }

    await recordVote(winnerId, loserId);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("POST /api/vote failed:", err);
    return Response.json({ error: "Failed to record vote" }, { status: 500 });
  }
}
