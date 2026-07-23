import { getBracketPool } from "@/lib/data";
import type { BracketMode } from "@/lib/types";

const VALID_SIZES = [16, 32, 64];
const VALID_MODES: BracketMode[] = ["major_league", "random"];

// Not cacheable: pool depends on the live vote-derived win-rate ranking.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const size = Number(params.get("size"));
  const mode = (params.get("mode") ?? "major_league") as BracketMode;

  if (!VALID_SIZES.includes(size)) {
    return Response.json(
      { error: `size must be one of ${VALID_SIZES.join(", ")}` },
      { status: 400 },
    );
  }
  if (!VALID_MODES.includes(mode)) {
    return Response.json(
      { error: `mode must be one of ${VALID_MODES.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const entrants = await getBracketPool(size, mode);
    return Response.json({ size, mode, entrants });
  } catch (err) {
    console.error("GET /api/bracket failed:", err);
    const message = err instanceof Error ? err.message : "Failed to build bracket pool";
    return Response.json({ error: message }, { status: 400 });
  }
}
