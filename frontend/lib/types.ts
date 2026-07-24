export type Rapper = {
  artist_id: string;
  artist_name: string;
  monthly_listeners: number;
  followers: number;
  world_rank: number | null;
  image_url: string | null;
  preview_url: string | null; // 30s clip of the artist's top track (hover preview)
  preview_track_name: string | null; // name of the track backing preview_url
  preview_credit: string | null; // full featured-artist credit line for preview_track_name
};

export type Track = {
  track_id: string;
  artist_id: string;
  track_name: string;
  track_rank: number;
  track_url: string;
  playcount: number | null; // lifetime Spotify stream count for the track
  // Scraped from Spotify's embed page (see lib/data.ts scrapeTrackMeta) so the
  // track row can be rendered natively instead of via a Spotify <iframe>.
  preview_url: string | null;
  duration_ms: number | null;
  image_url: string | null;
  is_explicit: boolean;
  credit: string | null; // featured-artist credit line, e.g. "Metro Boomin, Travis Scott"
  tint_color: string | null; // Spotify's embed background tint, e.g. "rgb(8, 32, 64)"
};

export type Matchup = {
  rapper1: Rapper;
  rapper2: Rapper;
  tracks1: Track[];
  tracks2: Track[];
};

export type RankingRow = {
  artist_id: string;
  artist_name: string;
  monthly_listeners: number;
  image_url: string | null;
  wins: number;
  losses: number;
  win_rate: number;
};

export type SeedEntry = Rapper & { seed: number };

export type BracketMode = "major_league" | "random";

export type BracketRankingRow = {
  artist_id: string;
  artist_name: string;
  monthly_listeners: number;
  image_url: string | null;
  championships: number;
  final_fours: number;
  wins: number;
  losses: number;
  win_rate: number;
};
