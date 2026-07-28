select
    artist_id,
    track_rank,
    track_name,
    track_id,
    track_url,
    playcount,
    last_seen_at
from {{ ref('stg_top_tracks') }}
