-- genres are no longer available per-artist; genre relevance comes from the
-- discovery seed, surfaced as flag_core_genre in staging.
select
    artist_id,
    artist_name,
    monthly_listeners,
    followers,
    world_rank,
    seeds,
    flag_core_genre,
    image_url,
    first_seen_at,
    last_seen_at
from {{ ref('stg_rappers') }}
