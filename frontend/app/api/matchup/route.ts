import { getMatchup } from "@/lib/data";

// Not cacheable: builds a fresh random matchup on every request.
export async function GET() {
  try {
    const matchup = await getMatchup();
    return Response.json(matchup);
  } catch (err) {
    console.error("GET /api/matchup failed:", err);
    return Response.json({ error: "Failed to build matchup" }, { status: 500 });
  }
}
