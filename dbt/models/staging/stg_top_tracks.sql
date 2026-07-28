-- raw.top_tracks is append-only alongside raw.rappers, so keep every track
-- from each artist's most recent observation and drop the older snapshots.
-- Filtering on the max per ARTIST (not one row per artist) is what preserves
-- the full top-10 set, and it means an artist surviving on staleness still has
-- tracks to play in a battle.
--
-- Compared at DAY granularity on purpose. Ingestion writes one snapshot per day
-- (it deletes the day's rows before inserting), and matching on the exact
-- timestamp would silently keep a single track per artist the moment two rows of
-- one run disagree by a microsecond -- which is exactly what a `now()` inside
-- executemany does. tests/assert_top_tracks_keeps_full_latest_set.sql guards it.
with observations as (
    select
        artist_id,
        track_rank,
        track_name,
        track_id,
        track_url,
        playcount,
        cast(load_date as timestamp) as load_date
    from {{ source('raw', 'top_tracks') }}
)

select
    artist_id,
    track_rank,
    track_name,
    track_id,
    track_url,
    playcount,
    load_date as last_seen_at
from observations
qualify cast(load_date as date) = max(cast(load_date as date)) over (partition by artist_id)
