import { getBracketPool } from "@/lib/data";

const VALID_SIZES = [16, 32, 64];

// Not cacheable: pool depends on the live vote-derived win-rate ranking.
export async function GET(request: Request) {
  const size = Number(new URL(request.url).searchParams.get("size"));

  if (!VALID_SIZES.includes(size)) {
    return Response.json(
      { error: `size must be one of ${VALID_SIZES.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const entrants = await getBracketPool(size);
    return Response.json({ size, entrants });
  } catch (err) {
    console.error("GET /api/bracket failed:", err);
    const message = err instanceof Error ? err.message : "Failed to build bracket pool";
    return Response.json({ error: message }, { status: 400 });
  }
}
