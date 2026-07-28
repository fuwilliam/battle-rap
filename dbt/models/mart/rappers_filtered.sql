{{
    config(
        materialized='table'
    )
}}

-- Current eligible set, rebuilt in FULL each run (not incremental) so artists
-- that drop out -- genre-filtered at ingestion, fallen below the thresholds,
-- or delisted -- actually disappear from matchups instead of lingering.
-- popularity (0-100) is gone; filter on monthly_listeners instead.
--
-- "Dropped out" now means ABSENT FOR A WHILE, not absent once. Ingestion is a
-- scrape of Spotify's internal endpoints, so a rate-limited run loses a random
-- ~5% of artists; the old rebuild-from-today's-rows read that as a delisting
-- and pulled real artists (Pusha T, Denzel Curry) out of battles overnight.
-- stg_rappers keeps each artist's last good observation, and the window below
-- is what actually retires them:
--
--   1 bad run    -> artist stays, on slightly stale listener counts
--   14 bad runs  -> artist retires from the pool
--   real delist  -> gone within 14 days
--
-- The app reads the battle pool (random matchups and bracket seeding alike)
-- only through here, so there's one definition of "eligible". The
-- *_ranking_live views deliberately read mart.rappers instead: a retired
-- artist's wins were still really won, so their leaderboard row outlives their
-- eligibility rather than orphaning the votes.
{% set staleness_window_days = 14 %}

select
    artist_id,
    artist_name,
    monthly_listeners,
    followers,
    world_rank,
    seeds,
    image_url,
    first_seen_at,
    last_seen_at
from {{ ref('rappers') }}
where flag_core_genre = true
    and monthly_listeners > 1000000
    and followers > 100000
    and last_seen_at >= current_date - interval {{ staleness_window_days }} day
