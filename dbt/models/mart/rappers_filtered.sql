{{
    config(
        materialized='table'
    )
}}

-- Current eligible set, rebuilt in FULL each run (not incremental) so artists
-- that drop out -- genre-filtered at ingestion, fallen below the thresholds,
-- or delisted -- actually disappear from matchups instead of lingering.
-- popularity (0-100) is gone; filter on monthly_listeners instead.
SELECT
    artist_id,
    artist_name,
    monthly_listeners,
    followers,
    world_rank,
    seeds,
    image_url,
    load_date
FROM {{ ref('rappers') }}
WHERE flag_core_genre = TRUE
AND monthly_listeners > 1000000
AND followers > 100000
