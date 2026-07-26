-- Current Elo, blended across both match types: casual head-to-head votes count
-- as "friendlies" (K=16), bracket matches count as "tournament games" (K=32) --
-- a bracket win moves the needle twice as much, same idea as a classical
-- tournament game mattering more than a casual chess.com blitz. Every artist
-- starts at 1500 the moment they play their first match (of either kind).
--
-- Elo is inherently sequential (each match's update depends on the state left by
-- the previous one), so this can't be one flat aggregate like win_rate. But the
-- rating vector fully summarises everything before it, so history doesn't need
-- replaying: mart.elo_daily holds the vector as of the last closed day, and this
-- model only replays the matches after it -- usually just today's.
--
-- That's the whole point of the split. Replaying all of history was
-- O(matches * artists), not O(matches): each recursion step rebuilds the entire
-- MAP to change two entries, so cost grew with *both* the match count and the
-- roster, i.e. superlinearly in calendar time. Per-run cost is now
-- O(today's matches * artists) and stays flat as history piles up.
WITH RECURSIVE matches AS (
    {{ elo_matches() }}
),

checkpoint_date AS (
    -- coalesce so a missing/empty elo_daily replays from match #1 rather than
    -- producing nothing -- correct either way, just slower.
    SELECT coalesce(max(as_of_date), DATE '1900-01-01') AS as_of_date
    FROM {{ ref('elo_daily') }}
),

-- Whatever elo_daily hasn't closed out yet: today, plus any earlier day that
-- slipped through if a run was missed.
new_matches AS (
    SELECT
        -- winner_id/loser_id as a tiebreak just makes the order deterministic
        -- for same-timestamp votes -- it doesn't need to mean anything.
        row_number() OVER (ORDER BY m.voted_at, m.winner_id, m.loser_id) AS match_number,
        m.winner_id,
        m.loser_id,
        m.k_factor
    FROM matches AS m, checkpoint_date AS c
    WHERE cast(m.voted_at AS DATE) > c.as_of_date
),

seed AS (
    SELECT coalesce(
        map_from_entries(list({'key': d.artist_id, 'value': d.elo_rating})),
        map([]::VARCHAR[], []::DOUBLE[])
    ) AS ratings
    FROM {{ ref('elo_daily') }} AS d, checkpoint_date AS c
    WHERE d.as_of_date = c.as_of_date
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

final_ratings AS (
    SELECT e.key AS artist_id, e.value AS elo_rating
    FROM elo_state, UNNEST(map_entries(ratings)) AS t(e)
    -- No matches since the checkpoint (max = NULL) means the checkpoint itself
    -- is the answer -- that's match_number 0, the seed row.
    WHERE match_number = (SELECT coalesce(max(match_number), 0) FROM new_matches)
),

-- Flat aggregate over the full history, and cheap, so it isn't checkpointed.
games_played AS (
    SELECT artist_id, count(*) AS games_played
    FROM (
        SELECT winner_id AS artist_id FROM matches
        UNION ALL
        SELECT loser_id AS artist_id FROM matches
    )
    GROUP BY artist_id
)

SELECT
    f.artist_id,
    f.elo_rating,
    g.games_played
FROM final_ratings f
JOIN games_played g USING (artist_id)
