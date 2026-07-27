{{ config(materialized='view') }}
-- Live head-to-head leaderboard. Backs /ranking (getRanking()).
--
-- A view, not a table, so it's evaluated at query time: a vote cast a second
-- ago is already counted. That's the point -- standings move without waiting
-- for a dbt run.
--
-- Reads raw.results directly rather than stg_results on purpose. stg_results is
-- an incremental TABLE, only refreshed by a dbt run, so building on it would
-- freeze the board between runs. That bypass is inherent to wanting live
-- counts; keeping it here rather than in the app means it's version-controlled,
-- tested, and visible in the dbt docs.
--
-- elo_rating is the one column that stays run-bound -- Elo is sequential (see
-- elo.sql), so it can't be recomputed per request.
--
-- No ORDER BY: an outer SELECT isn't guaranteed to preserve a view's internal
-- ordering, so callers sort explicitly.
WITH wins AS (
    SELECT winner_id AS artist_id, count(*) AS wins
    FROM {{ source('raw', 'results') }}
    GROUP BY 1
),

losses AS (
    SELECT loser_id AS artist_id, count(*) AS losses
    FROM {{ source('raw', 'results') }}
    GROUP BY 1
)

SELECT
    r.artist_id,
    r.artist_name,
    r.monthly_listeners,
    r.image_url,
    coalesce(w.wins, 0) AS wins,
    coalesce(l.losses, 0) AS losses,
    coalesce(w.wins, 0)::DOUBLE
        / nullif(coalesce(w.wins, 0) + coalesce(l.losses, 0), 0) AS win_rate,
    coalesce(e.elo_rating, 1500) AS elo_rating
FROM {{ ref('rappers') }} AS r
LEFT JOIN wins AS w USING (artist_id)
LEFT JOIN losses AS l USING (artist_id)
LEFT JOIN {{ ref('elo') }} AS e USING (artist_id)
-- fewer than 5 matches isn't a record yet
WHERE coalesce(w.wins, 0) + coalesce(l.losses, 0) >= 5
