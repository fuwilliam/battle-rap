-- Drift audit: replay the ENTIRE match history from match #1 with the old
-- (pre-checkpoint) logic and diff it against the checkpointed mart.elo. Any row
-- returned is drift -- the two disagree and the checkpoints are wrong.
--
-- Deliberately an analysis, not a test: this is the O(matches * artists) work the
-- checkpointing exists to avoid, so it must not run on every `dbt build`. Run it
-- by hand after changing the Elo logic, or when you suspect drift:
--
--     dbt compile -s elo_full_replay --profiles-dir .
--     duckdb md:battlerap < target/compiled/battle_rap/analyses/elo_full_replay.sql
--
-- Zero rows = incremental output is bit-for-bit what a from-scratch rebuild
-- would produce. If it isn't:
--     dbt run --full-refresh -s mart.elo_daily+ --profiles-dir .
--
-- Expected legitimate cause of drift: a match arriving with a voted_at older
-- than the watermark. The staging models already drop those on their own
-- watermark (see stg_results.sql), so this should stay empty in practice.
WITH RECURSIVE matches AS (
    {{ elo_matches() }}
),

ordered_matches AS (
    SELECT
        row_number() OVER (ORDER BY voted_at, winner_id, loser_id) AS match_number,
        winner_id,
        loser_id,
        k_factor
    FROM matches
),

elo_state AS (
    -- match_number = 0: nobody's played yet
    SELECT 0 AS match_number, map([]::VARCHAR[], []::DOUBLE[]) AS ratings

    UNION ALL

    SELECT
        nxt.match_number,
        {{ elo_update('prev', 'nxt') }} AS ratings
    FROM elo_state AS prev
    JOIN ordered_matches AS nxt ON nxt.match_number = prev.match_number + 1
),

from_scratch AS (
    SELECT e.key AS artist_id, e.value AS elo_rating
    FROM elo_state, UNNEST(map_entries(ratings)) AS t(e)
    WHERE match_number = (SELECT coalesce(max(match_number), 0) FROM ordered_matches)
)

SELECT
    coalesce(s.artist_id, i.artist_id) AS artist_id,
    s.elo_rating AS full_replay_elo,
    i.elo_rating AS incremental_elo,
    i.elo_rating - s.elo_rating AS drift
FROM from_scratch AS s
FULL OUTER JOIN {{ ref('elo') }} AS i USING (artist_id)
-- float tolerance: the two take different code paths to the same arithmetic, so
-- allow last-bit noise but nothing a rating would actually notice
WHERE s.artist_id IS NULL
    OR i.artist_id IS NULL
    OR abs(i.elo_rating - s.elo_rating) > 1e-6
ORDER BY abs(coalesce(i.elo_rating - s.elo_rating, 0)) DESC
