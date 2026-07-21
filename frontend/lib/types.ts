export type Rapper = {
  artist_id: string;
  artist_name: string;
  monthly_listeners: number;
  followers: number;
  world_rank: number | null;
  image_url: string | null;
  preview_url: string | null; // 30s clip of the artist's top track (hover preview)
};

export type Track = {
  track_id: string;
  artist_id: string;
  track_name: string;
  track_rank: number;
  track_url: string;
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
