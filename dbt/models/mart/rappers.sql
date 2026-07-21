-- genres are no longer available per-artist; genre relevance comes from the
-- discovery seed, surfaced as flag_core_genre in staging.
SELECT
    artist_id,
    artist_name,
    monthly_listeners,
    followers,
    world_rank,
    seeds,
    flag_core_genre,
    image_url,
    load_date
FROM {{ ref('stg_rappers') }}
