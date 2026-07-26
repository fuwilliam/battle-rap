{{
    config(
        materialized='incremental',
        unique_key=['as_of_date', 'artist_id']
    )
}}
-- Daily Elo checkpoints: the full rating vector as it stood at the close of
-- each day that had matches.
--
-- Why this exists: Elo is sequential, but the rating vector is a *complete*
-- summary of every match before it -- nothing else from history is needed to
-- keep going. So any saved vector is a valid resume point, which lets mart.elo
-- replay only today instead of all of history on every dbt run.
--
-- Append-only by construction: `current_date` is excluded, so a row here is
-- never rewritten once written. Today's still-moving state lives in mart.elo.
--
-- Also doubles as an Elo-over-time series (one vector per active day), which is
-- what any rating-trend chart should read from rather than recomputing.
--
-- IMPORTANT: this table caches the *output* of the Elo formula. Change the K
-- factors here or the math in macros/elo_update.sql and every existing
-- checkpoint becomes stale without dbt noticing. Rebuild explicitly:
--     dbt run --full-refresh -s mart.elo_daily+
WITH RECURSIVE matches AS (
    {{ elo_matches() }}
),

-- Everything on or before this date is already checkpointed and immutable.
watermark AS (
    {% if is_incremental() %}
        -- coalesce so an empty table (max = NULL) replays everything, not nothing
        SELECT coalesce(max(as_of_date), DATE '1900-01-01') AS as_of_date FROM {{ this }}
    {% else %}
        SELECT DATE '1900-01-01' AS as_of_date
    {% endif %}
),

new_matches AS (
    SELECT
        -- winner_id/loser_id as a tiebreak just makes the order deterministic
        -- for same-timestamp votes -- it doesn't need to mean anything.
        row_number() OVER (ORDER BY m.voted_at, m.winner_id, m.loser_id) AS match_number,
        cast(m.voted_at AS DATE) AS match_date,
        m.winner_id,
        m.loser_id,
        m.k_factor
    FROM matches AS m, watermark AS w
    WHERE cast(m.voted_at AS DATE) > w.as_of_date
        -- Today can still receive votes, so freezing it now would drop every
        -- vote cast after this run: the next run's watermark would already be
        -- today, and `> watermark` would skip them forever. Checkpoint it
        -- tomorrow, once it can't change.
        AND cast(m.voted_at AS DATE) < current_date
),

seed AS (
    {% if is_incremental() %}
        -- Resume from the last checkpoint instead of match #1. Aggregating with
        -- no GROUP BY still yields one row when the table is empty, so the
        -- coalesce turns "no checkpoint yet" into an empty map.
        SELECT coalesce(
            map_from_entries(list({'key': c.artist_id, 'value': c.elo_rating})),
            map([]::VARCHAR[], []::DOUBLE[])
        ) AS ratings
        FROM {{ this }} AS c, watermark AS w
        WHERE c.as_of_date = w.as_of_date
    {% else %}
        -- nobody's played yet
        SELECT map([]::VARCHAR[], []::DOUBLE[]) AS ratings
    {% endif %}
),

-- Threading the whole ratings table through as a single MAP value keeps this at
-- one row per match rather than one row per artist per match.
elo_state AS (
    SELECT 0 AS match_number, ratings FROM seed

    UNION ALL

    SELECT
        nxt.match_number,
        {{ elo_update('prev', 'nxt') }} AS ratings
    FROM elo_state AS prev
    JOIN new_matches AS nxt ON nxt.match_number = prev.match_number + 1
),

-- the state after a day's last match *is* that day's closing checkpoint
day_ends AS (
    SELECT match_date, max(match_number) AS match_number
    FROM new_matches
    GROUP BY match_date
),

day_end_state AS (
    SELECT d.match_date, s.ratings
    FROM day_ends AS d
    JOIN elo_state AS s USING (match_number)
)

SELECT
    dst.match_date AS as_of_date,
    e.key AS artist_id,
    e.value AS elo_rating
FROM day_end_state AS dst, UNNEST(map_entries(dst.ratings)) AS t(e)
