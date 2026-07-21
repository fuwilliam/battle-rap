import { getSupabase } from "./supabase";
import type { Matchup, Rapper, RankingRow, Track } from "./types";

// Same eligibility filter the original Flask app used.
const MIN_MONTHLY_LISTENERS = 1_000_000;
const MIN_FOLLOWERS = 100_000;

async function eligibleRappers(): Promise<Rapper[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("rappers")
    .select("artist_id, artist_name, monthly_listeners, followers, world_rank, image_url")
    .eq("flag_core_genre", true)
    .gte("monthly_listeners", MIN_MONTHLY_LISTENERS)
    .gte("followers", MIN_FOLLOWERS);

  if (error) throw error;
  return (data ?? []) as Rapper[];
}

async function topTracks(artistId: string): Promise<Track[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("top_tracks")
    .select("track_id, artist_id, track_name, track_rank, track_url")
    .eq("artist_id", artistId)
    .lte("track_rank", 3)
    .order("track_rank", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Track[];
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

  return { rapper1, rapper2, tracks1, tracks2 };
}

export async function recordVote(winnerId: string, loserId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("results").insert({
    matchup_id: crypto.randomUUID(),
    winner_id: winnerId,
    loser_id: loserId,
    voted_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function getRanking(): Promise<RankingRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("rankings")
    .select("artist_id, artist_name, monthly_listeners, followers, wins, losses, win_rate")
    .order("win_rate", { ascending: false });

  if (error) throw error;
  return (data ?? []) as RankingRow[];
}
