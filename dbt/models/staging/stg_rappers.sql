-- raw.rappers is append-only: one snapshot row per artist per ingestion run.
-- Collapse that to the artist's MOST RECENT observation, and carry when they
-- were first and last seen.
--
-- last_seen_at is the point of the whole thing: an artist missing from today's
-- run (transient 429, Spotify hiccup) keeps their last good row instead of
-- vanishing from the battle pool, and mart.rappers_filtered ages them out only
-- once they've been gone long enough to mean it.
with observations as (
    select
        artist_id,
        artist_name,
        monthly_listeners,
        followers,
        world_rank,
        seeds,
        flag_core_genre,
        image_url,
        cast(load_date as timestamp) as load_date
    from {{ source('raw', 'rappers') }}
)

select
    artist_id,
    artist_name,
    monthly_listeners,
    followers,
    world_rank,
    seeds,
    flag_core_genre,
    image_url,
    min(load_date) over (partition by artist_id) as first_seen_at,
    -- the surviving row is the latest one, so its load_date IS the max
    load_date as last_seen_at
from observations
qualify row_number() over (partition by artist_id order by load_date desc) = 1
