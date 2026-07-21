export type Rapper = {
  artist_id: string;
  artist_name: string;
  monthly_listeners: number;
  followers: number;
  world_rank: number | null;
  image_url: string | null;
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
  followers: number;
  wins: number;
  losses: number;
  win_rate: number;
};
