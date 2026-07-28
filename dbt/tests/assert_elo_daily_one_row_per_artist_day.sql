-- elo_daily's grain is (as_of_date, artist_id). A duplicate means an incremental
-- run re-emitted a day that was already checkpointed, which would double-count
-- that day's matches for anyone reading the history series.
select
    as_of_date,
    artist_id,
    count(*) as rows_for_grain
from {{ ref('elo_daily') }}
group by as_of_date, artist_id
having count(*) > 1
