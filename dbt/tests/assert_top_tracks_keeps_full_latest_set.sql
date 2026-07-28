-- mart.top_tracks must carry an artist's WHOLE latest track set, not just one row
-- of it. raw.top_tracks is append-only, so staging picks the artist's most recent
-- snapshot -- and if that "most recent" comparison is ever done at a finer
-- granularity than the run actually stamps (a `now()` evaluated per row inside
-- executemany gives every row its own microsecond), every artist silently
-- collapses to a single track. Battles would still render, just with one track
-- and no hover preview, which is why this needs a test rather than a code comment.
with latest_day as (
    select
        artist_id,
        max(cast(load_date as date)) as load_day
    from {{ source('raw', 'top_tracks') }}
    group by artist_id
),

expected as (
    select
        raw_tracks.artist_id,
        count(*) as expected_tracks
    from {{ source('raw', 'top_tracks') }} as raw_tracks
    inner join latest_day
        on
        raw_tracks.artist_id = latest_day.artist_id
        and cast(raw_tracks.load_date as date) = latest_day.load_day
    group by raw_tracks.artist_id
),

actual as (
    select
        artist_id,
        count(*) as actual_tracks
    from {{ ref('top_tracks') }}
    group by artist_id
)

select
    expected.artist_id,
    expected.expected_tracks,
    coalesce(actual.actual_tracks, 0) as actual_tracks
from expected
left join actual on expected.artist_id = actual.artist_id
where coalesce(actual.actual_tracks, 0) != expected.expected_tracks
