import { execute, query } from "./motherduck";
import type { BracketRankingRow, Matchup, Rapper, RankingRow, SeedEntry, Track } from "./types";

// Eligibility (flag_core_genre + monthly_listeners >= 1M + followers >= 100k)
// is encoded in the dbt model mart.rappers_filtered -- one source of truth.
async function eligibleRappers(): Promise<Rapper[]> {
  return query<Rapper>(
    `SELECT artist_id, artist_name, monthly_listeners, followers, world_rank, image_url
     FROM mart.rappers_filtered`,
  );
}

// Fetch 5 so the preview clip has variety to pick from; only the top 3 are
// ever shown as embeds (sliced in pairTracks below).
async function topTracks(artistId: string): Promise<Track[]> {
  return query<Track>(
    `SELECT track_id, artist_id, track_name, track_rank, track_url
     FROM mart.top_tracks
     WHERE artist_id = ? AND track_rank <= 5
     ORDER BY track_rank`,
    [artistId],
  );
}

function randomTrackId(tracks: Track[]): string | undefined {
  if (tracks.length === 0) return undefined;
  return tracks[Math.floor(Math.random() * tracks.length)].track_id;
}

// Top 3 tracks (for the visible embeds) + a hover-preview clip randomly
// picked from the top 5 (so it's not the same snippet every single time) for
// a specific pair of artists -- used for both the random head-to-head
// matchup and a single bracket match.
export async function pairTracks(
  id1: string,
  id2: string,
): Promise<{ tracks1: Track[]; preview1: string | null; tracks2: Track[]; preview2: string | null }> {
  const [top1, top2] = await Promise.all([topTracks(id1), topTracks(id2)]);
  const [preview1, preview2] = await Promise.all([
    topPreviewUrl(randomTrackId(top1)),
    topPreviewUrl(randomTrackId(top2)),
  ]);
  return { tracks1: top1.slice(0, 3), preview1, tracks2: top2.slice(0, 3), preview2 };
}

// Pick two distinct random eligible rappers + their top tracks.
export async function getMatchup(): Promise<Matchup> {
  const pool = await eligibleRappers();
  if (pool.length < 2) {
    throw new Error("Not enough eligible rappers to build a matchup.");
  }

  const i = Math.floor(Math.random() * pool.length);
  let j = Math.floor(Math.random() * (pool.length - 1));
  if (j >= i) j += 1; // ensure j != i, uniformly

  const rapper1 = pool[i];
  const rapper2 = pool[j];

  const { tracks1, preview1, tracks2, preview2 } = await pairTracks(
    rapper1.artist_id,
    rapper2.artist_id,
  );

  return {
    rapper1: { ...rapper1, preview_url: preview1 },
    rapper2: { ...rapper2, preview_url: preview2 },
    tracks1,
    tracks2,
  };
}

// The 30s preview MP3 isn't exposed by the API anymore; scrape it from the
// track's embed page (same __NEXT_DATA__ trick as the playlist reader).
async function topPreviewUrl(trackId?: string): Promise<string | null> {
  if (!trackId) return null;
  try {
    const res = await fetch(`https://open.spotify.com/embed/track/${trackId}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const html = await res.text();
    const m = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
    );
    if (!m) return null;
    const data = JSON.parse(m[1]);
    return data?.props?.pageProps?.state?.data?.entity?.audioPreview?.url ?? null;
  } catch {
    return null;
  }
}

export async function recordVote(winnerId: string, loserId: string): Promise<void> {
  await execute(
    `INSERT INTO raw.results (matchup_id, winner_id, loser_id, voted_at)
     VALUES (?, ?, ?, now()::TIMESTAMP)`,
    [crypto.randomUUID(), winnerId, loserId],
  );
}

// Live leaderboard: aggregate votes straight from raw.results (updates the
// instant a vote lands) and join to the daily-built rapper stats. No dbt run
// needed for standings to move.
export async function getRanking(): Promise<RankingRow[]> {
  return query<RankingRow>(
    `WITH wins AS (
       SELECT winner_id AS artist_id, count(*) AS wins FROM raw.results GROUP BY 1
     ),
     losses AS (
       SELECT loser_id AS artist_id, count(*) AS losses FROM raw.results GROUP BY 1
     )
     SELECT
       r.artist_id,
       r.artist_name,
       r.monthly_listeners,
       r.image_url,
       coalesce(w.wins, 0) AS wins,
       coalesce(l.losses, 0) AS losses,
       coalesce(w.wins, 0)::double
         / nullif(coalesce(w.wins, 0) + coalesce(l.losses, 0), 0) AS win_rate
     FROM mart.rappers r
     LEFT JOIN wins w USING (artist_id)
     LEFT JOIN losses l USING (artist_id)
     WHERE coalesce(w.wins, 0) + coalesce(l.losses, 0) >= 5
     ORDER BY win_rate DESC, wins DESC, monthly_listeners DESC`,
  );
}

// Every artist with a proven win-rate track record (>=5 votes), best first.
// Unbounded (unlike byListeners it's normally a small subset) so getBracketPool
// can compute a true percentile rather than one truncated to the bracket size.
async function byWinRate(): Promise<Rapper[]> {
  return query<Rapper>(
    `WITH wins AS (
       SELECT winner_id AS artist_id, count(*) AS wins FROM raw.results GROUP BY 1
     ),
     losses AS (
       SELECT loser_id AS artist_id, count(*) AS losses FROM raw.results GROUP BY 1
     )
     SELECT r.artist_id, r.artist_name, r.monthly_listeners, r.followers, r.world_rank, r.image_url
     FROM mart.rappers_filtered r
     LEFT JOIN wins w USING (artist_id)
     LEFT JOIN losses l USING (artist_id)
     WHERE coalesce(w.wins, 0) + coalesce(l.losses, 0) >= 5
     ORDER BY
       coalesce(w.wins, 0)::double / nullif(coalesce(w.wins, 0) + coalesce(l.losses, 0), 0) DESC,
       coalesce(w.wins, 0) DESC`,
  );
}

// All eligible rappers ordered by popularity (used both as the "top by
// listeners" half of the bracket pool and to backfill it when the win-rate
// list is short).
async function byListeners(): Promise<Rapper[]> {
  return query<Rapper>(
    `SELECT artist_id, artist_name, monthly_listeners, followers, world_rank, image_url
     FROM mart.rappers_filtered
     ORDER BY monthly_listeners DESC`,
  );
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// 1 in 8 slots (min 1) are wildcards -- random eligible artists outside the
// blended top cut, so repeated brackets of the same size aren't identical.
function wildcardCount(size: number): number {
  return Math.max(1, Math.floor(size / 8));
}

// Win rate matters more than raw popularity for seeding: a proven track
// record should beat a big streaming number with no votes behind it. Weights
// are applied to PERCENTILE position within each list (not raw rank index) --
// mixing raw indices was the bug: the win-rate list is small (only artists
// with >=5 votes) while the listeners list spans the whole eligible pool
// (hundreds of artists), so an untested-but-popular artist's raw listeners
// rank could dwarf a proven battler's raw win-rate rank even though the
// battler was actually near the top of a real (if small) leaderboard.
const WEIGHT_WIN_RATE = 0.65;
const WEIGHT_LISTENERS = 0.35;

// Random jitter added to each score before sorting, so seed order (and thus
// which artists land in which Round-of-16-style pairing) isn't identical
// every time the same underlying votes/listeners data produces the same
// blend -- without this, wildcards were the only source of variety and the
// deterministic "core" always seeded (and matched up) in the exact same
// order. Big enough to reshuffle closely-ranked neighbors and occasionally
// the very top; small enough that a rank-500 artist can't leapfrog into #1.
const SEED_JITTER = 0.25;

// Bracket seeding pool: blend the win-rate leaderboard with the listeners
// leaderboard into one seed order (win rate weighted more heavily -- see
// above), dedup, then reserve a handful of the worst seeds as wildcards --
// randomly drawn from the rest of the eligible pool -- so the field has some
// variety run to run instead of being 100% deterministic off the same data.
export async function getBracketPool(size: number): Promise<SeedEntry[]> {
  const [winRateRanked, listenersRanked] = await Promise.all([byWinRate(), byListeners()]);

  if (listenersRanked.length < size) {
    throw new Error(
      `Not enough eligible rappers for a ${size}-artist bracket (only ${listenersRanked.length} qualify).`,
    );
  }

  const posByWinRate = new Map(winRateRanked.map((r, i) => [r.artist_id, i]));
  const posByListeners = new Map(listenersRanked.map((r, i) => [r.artist_id, i]));
  // listenersRanked already spans every eligible artist, so it alone defines
  // the full pool -- winRateRanked is a subset and adds nothing new here.
  const byId = new Map(listenersRanked.map((r) => [r.artist_id, r]));

  // byId spans the whole eligible pool (byListeners has no LIMIT), and that
  // pool is >= size (checked above), so there's always enough left over here.
  const wildcards = wildcardCount(size);
  const coreSize = size - wildcards;

  // position -> [0,1], 0 = best. Absence from win-rate (never proven) scores
  // as the worst possible percentile rather than a fixed small penalty.
  const pct = (pos: number | undefined, poolSize: number) =>
    poolSize <= 1 || pos === undefined ? 1 : pos / (poolSize - 1);

  const blended = [...byId.values()]
    .map((r) => ({
      rapper: r,
      score:
        WEIGHT_WIN_RATE * pct(posByWinRate.get(r.artist_id), winRateRanked.length) +
        WEIGHT_LISTENERS * pct(posByListeners.get(r.artist_id), listenersRanked.length) +
        (Math.random() - 0.5) * SEED_JITTER,
    }))
    .sort((a, b) => a.score - b.score || b.rapper.monthly_listeners - a.rapper.monthly_listeners);

  const core = blended.slice(0, coreSize).map(({ rapper }) => rapper);
  const coreIds = new Set(core.map((r) => r.artist_id));
  const remainder = blended.map(({ rapper }) => rapper).filter((r) => !coreIds.has(r.artist_id));
  const wildcardPicks = shuffle(remainder).slice(0, wildcards);

  return [...core, ...wildcardPicks].map((rapper, i) => ({
    ...rapper,
    preview_url: null,
    seed: i + 1,
  }));
}

// Bracket picks are recorded separately from raw.results: bracket matchups
// are seeded, not random, so folding them into the head-to-head ledger would
// skew that leaderboard's win rate. `matchesInRound` is however many matches
// were being played in that round (2 = Final Four, 1 = the Final) -- enough
// for getBracketRanking to derive championships/Final Four appearances.
export async function recordBracketVote(
  runId: string,
  matchesInRound: number,
  winnerId: string,
  loserId: string,
): Promise<void> {
  // Defensive create: the ingestion job (ingestion/load_rappers.py) bootstraps
  // this table too, but only runs on its daily schedule -- don't make a
  // same-day deploy of bracket mode 500 until the next run.
  await execute(`CREATE SCHEMA IF NOT EXISTS raw`);
  await execute(
    `CREATE TABLE IF NOT EXISTS raw.bracket_results (
       run_id VARCHAR, matches_in_round BIGINT, winner_id VARCHAR, loser_id VARCHAR, voted_at TIMESTAMP
     )`,
  );
  await execute(
    `INSERT INTO raw.bracket_results (run_id, matches_in_round, winner_id, loser_id, voted_at)
     VALUES (?, ?, ?, ?, now()::TIMESTAMP)`,
    [runId, matchesInRound, winnerId, loserId],
  );
}

// Bracket standings: proven bracket win rate + championships (winner of the
// matches_in_round=1 "Final" row) + Final Four appearances (either side of a
// matches_in_round=2 "semifinal" row -- both semifinalists count, win or lose).
export async function getBracketRanking(): Promise<BracketRankingRow[]> {
  return query<BracketRankingRow>(
    `WITH wins AS (
       SELECT winner_id AS artist_id, count(*) AS wins FROM raw.bracket_results GROUP BY 1
     ),
     losses AS (
       SELECT loser_id AS artist_id, count(*) AS losses FROM raw.bracket_results GROUP BY 1
     ),
     championships AS (
       SELECT winner_id AS artist_id, count(*) AS championships
       FROM raw.bracket_results WHERE matches_in_round = 1 GROUP BY 1
     ),
     final_four_appearances AS (
       SELECT artist_id, count(*) AS final_fours FROM (
         SELECT winner_id AS artist_id FROM raw.bracket_results WHERE matches_in_round = 2
         UNION ALL
         SELECT loser_id AS artist_id FROM raw.bracket_results WHERE matches_in_round = 2
       ) GROUP BY 1
     )
     SELECT
       r.artist_id,
       r.artist_name,
       r.monthly_listeners,
       r.image_url,
       coalesce(c.championships, 0) AS championships,
       coalesce(f.final_fours, 0) AS final_fours,
       coalesce(w.wins, 0) AS wins,
       coalesce(l.losses, 0) AS losses,
       coalesce(w.wins, 0)::double
         / nullif(coalesce(w.wins, 0) + coalesce(l.losses, 0), 0) AS win_rate
     FROM mart.rappers r
     LEFT JOIN wins w USING (artist_id)
     LEFT JOIN losses l USING (artist_id)
     LEFT JOIN championships c USING (artist_id)
     LEFT JOIN final_four_appearances f USING (artist_id)
     WHERE coalesce(w.wins, 0) + coalesce(l.losses, 0) > 0
     ORDER BY championships DESC, final_fours DESC, win_rate DESC, wins DESC`,
  );
}
