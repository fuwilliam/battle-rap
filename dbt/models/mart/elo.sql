-- Elo, blended across both match types: casual head-to-head votes count as
-- "friendlies" (K=16), bracket matches count as "tournament games" (K=32) --
-- a bracket win moves the needle twice as much, same idea as a classical
-- tournament game mattering more than a casual chess.com blitz. Every artist
-- starts at 1500 the moment they play their first match (of either kind).
--
-- Elo is inherently sequential (each match's update depends on the state left
-- by the previous one), so this can't be one flat aggregate like win_rate.
-- The trick: thread the *entire* ratings table through the recursion as a
-- single MAP(artist_id -> rating) value, one row per match, updating just the
-- two entries that played. That keeps the recursive CTE at O(matches) rows
-- instead of O(matches * artists), which a naive "one row per artist per
-- match" snapshot would be.
WITH RECURSIVE matches AS (
    SELECT winner_id, loser_id, voted_at, 16.0 AS k_factor
    FROM {{ ref('stg_results') }}

    UNION ALL

    SELECT winner_id, loser_id, voted_at, 32.0 AS k_factor
    FROM {{ ref('stg_bracket_results') }}
),

ordered_matches AS (
    SELECT
        -- winner_id/loser_id as a tiebreak just makes the order deterministic
        -- for same-timestamp votes -- it doesn't need to mean anything.
        row_number() OVER (ORDER BY voted_at, winner_id, loser_id) AS match_number,
        winner_id,
        loser_id,
        k_factor
    FROM matches
),

elo_state AS (
    -- match_number = 0: nobody's played yet.
    SELECT 0 AS match_number, map([]::VARCHAR[], []::DOUBLE[]) AS ratings

    UNION ALL

    SELECT
        nxt.match_number,
        map_from_entries(
            list_concat(
                -- carry every other artist's rating forward untouched
                list_filter(
                    map_entries(prev.ratings),
                    lambda entry: entry.key NOT IN (nxt.winner_id, nxt.loser_id)
                ),
                -- ...and replace (or add, on a first appearance) the two that played
                [
                    {
                        'key': nxt.winner_id,
                        'value':
                            coalesce(prev.ratings[nxt.winner_id], 1500) + nxt.k_factor * (
                                1 - 1.0 / (1 + power(
                                    10,
                                    (coalesce(prev.ratings[nxt.loser_id], 1500)
                                        - coalesce(prev.ratings[nxt.winner_id], 1500)) / 400.0
                                ))
                            )
                    },
                    {
                        'key': nxt.loser_id,
                        'value':
                            coalesce(prev.ratings[nxt.loser_id], 1500) + nxt.k_factor * (
                                0 - 1.0 / (1 + power(
                                    10,
                                    (coalesce(prev.ratings[nxt.winner_id], 1500)
                                        - coalesce(prev.ratings[nxt.loser_id], 1500)) / 400.0
                                ))
                            )
                    }
                ]
            )
        ) AS ratings
    FROM elo_state AS prev
    JOIN ordered_matches AS nxt ON nxt.match_number = prev.match_number + 1
),

final_ratings AS (
    SELECT e.key AS artist_id, e.value AS elo_rating
    FROM elo_state, UNNEST(map_entries(ratings)) AS t(e)
    WHERE match_number = (SELECT max(match_number) FROM ordered_matches)
),

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
