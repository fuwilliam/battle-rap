import { pairTracks } from "@/lib/data";

// Fetch tracks/preview for exactly one bracket match's two artists, on
// demand, rather than for the whole pool up front -- Spotify's embed
// endpoint throttles when too many preview scrapes fire at once.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const a = params.get("a");
  const b = params.get("b");

  if (!a || !b) {
    return Response.json({ error: "a and b artist ids are required" }, { status: 400 });
  }

  try {
    const { tracks1, preview1, tracks2, preview2 } = await pairTracks(a, b);
    return Response.json({
      tracksA: tracks1,
      previewA: preview1,
      tracksB: tracks2,
      previewB: preview2,
    });
  } catch (err) {
    console.error("GET /api/bracket/tracks failed:", err);
    return Response.json({ error: "Failed to fetch match tracks" }, { status: 500 });
  }
}
