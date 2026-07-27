{{ config(materialized='view') }}
-- Live bracket leaderboard: proven bracket win rate + championships + Final
-- Four appearances. Backs /ranking's bracket table (getBracketRanking()).
--
-- A view over raw.bracket_results for the same reason as ranking_live -- see
-- that model for why staging is bypassed.
--
-- Round identification is by matches_in_round, since that's what the vote
-- recorder writes: 1 means the Final (one match left), 2 means the semifinals.
-- Both semifinalists count as a Final Four appearance, win or lose.
--
-- No ORDER BY: an outer SELECT isn't guaranteed to preserve a view's internal
-- ordering, so callers sort explicitly.
WITH wins AS (
    SELECT winner_id AS artist_id, count(*) AS wins
    FROM {{ source('raw', 'bracket_results') }}
    GROUP BY 1
),

losses AS (
    SELECT loser_id AS artist_id, count(*) AS losses
    FROM {{ source('raw', 'bracket_results') }}
    GROUP BY 1
),

championships AS (
    SELECT winner_id AS artist_id, count(*) AS championships
    FROM {{ source('raw', 'bracket_results') }}
    WHERE matches_in_round = 1
    GROUP BY 1
),

final_four_appearances AS (
    SELECT artist_id, count(*) AS final_fours
    FROM (
        SELECT winner_id AS artist_id
        FROM {{ source('raw', 'bracket_results') }}
        WHERE matches_in_round = 2

        UNION ALL

        SELECT loser_id AS artist_id
        FROM {{ source('raw', 'bracket_results') }}
        WHERE matches_in_round = 2
    )
    GROUP BY 1
)

SELECT
    r.artist_id,
    r.artist_name,
    r.monthly_listeners,
    r.image_url,
    coalesce(c.championships, 0) AS championships,
    coalesce(f.final_fours, 0) AS final_fours,
    coalesce(w.wins, 0) AS wins,
    coalesce(l.losses, 0) AS losses,
    coalesce(w.wins, 0)::DOUBLE
        / nullif(coalesce(w.wins, 0) + coalesce(l.losses, 0), 0) AS win_rate,
    coalesce(e.elo_rating, 1500) AS elo_rating
FROM {{ ref('rappers') }} AS r
LEFT JOIN wins AS w USING (artist_id)
LEFT JOIN losses AS l USING (artist_id)
LEFT JOIN championships AS c USING (artist_id)
LEFT JOIN final_four_appearances AS f USING (artist_id)
LEFT JOIN {{ ref('elo') }} AS e USING (artist_id)
-- must have actually played a bracket match
WHERE coalesce(w.wins, 0) + coalesce(l.losses, 0) > 0
