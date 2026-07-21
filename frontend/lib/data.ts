import { execute, query } from "./motherduck";
import type { Matchup, Rapper, RankingRow, Track } from "./types";

// Eligibility (flag_core_genre + monthly_listeners >= 1M + followers >= 100k)
// is encoded in the dbt model mart.rappers_filtered -- one source of truth.
async function eligibleRappers(): Promise<Rapper[]> {
  return query<Rapper>(
    `SELECT artist_id, artist_name, monthly_listeners, followers, world_rank, image_url
     FROM mart.rappers_filtered`,
  );
}

async function topTracks(artistId: string): Promise<Track[]> {
  return query<Track>(
    `SELECT track_id, artist_id, track_name, track_rank, track_url
     FROM mart.top_tracks
     WHERE artist_id = ? AND track_rank <= 3
     ORDER BY track_rank`,
    [artistId],
  );
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

  const [tracks1, tracks2] = await Promise.all([
    topTracks(rapper1.artist_id),
    topTracks(rapper2.artist_id),
  ]);
  const [preview1, preview2] = await Promise.all([
    topPreviewUrl(tracks1[0]?.track_id),
    topPreviewUrl(tracks2[0]?.track_id),
  ]);

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

export async function getRanking(): Promise<RankingRow[]> {
  return query<RankingRow>(
    `SELECT artist_id, artist_name, monthly_listeners, wins, losses, win_rate
     FROM mart.rankings
     ORDER BY win_rate DESC, wins DESC`,
  );
}
