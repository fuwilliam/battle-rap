import { getBracketArtistStats } from "@/lib/data";

// Fetched by the champion screen once a run is decided -- not needed up
// front, so it's on-demand rather than baked into the bracket pool response.
export async function GET(request: Request) {
  const artistId = new URL(request.url).searchParams.get("artistId");
  if (!artistId) {
    return Response.json({ error: "artistId is required" }, { status: 400 });
  }

  try {
    const stats = await getBracketArtistStats(artistId);
    return Response.json({ stats });
  } catch (err) {
    console.error("GET /api/bracket/artist-stats failed:", err);
    return Response.json({ error: "Failed to fetch artist stats" }, { status: 500 });
  }
}
