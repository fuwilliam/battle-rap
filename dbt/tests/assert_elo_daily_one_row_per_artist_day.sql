-- elo_daily's grain is (as_of_date, artist_id). A duplicate means an incremental
-- run re-emitted a day that was already checkpointed, which would double-count
-- that day's matches for anyone reading the history series.
SELECT
    as_of_date,
    artist_id,
    count(*) AS rows_for_grain
FROM {{ ref('elo_daily') }}
GROUP BY as_of_date, artist_id
HAVING count(*) > 1
