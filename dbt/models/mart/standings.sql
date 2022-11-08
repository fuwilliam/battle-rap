WITH 
artists AS 
(
    SELECT 
        artist_id,
        artist_name
    FROM {{ ref('rappers') }}
),
wins AS 
(
   SELECT 
      winner_id,
      count(1) AS wins
   FROM {{ ref('stg_results') }}
   GROUP BY winner_id
), 
losses AS 
(
   SELECT 
      loser_id,
      count(1) AS losses
   FROM {{ ref('stg_results') }}
   GROUP BY loser_id
), 
record AS (
   SELECT 
      a.artist_id,
      a.artist_name,
      COALESCE(w.wins, 0) AS wins,
      COALESCE(l.losses, 0) AS losses
   FROM artists a
      LEFT JOIN wins w ON a.artist_id = w.winner_id
      LEFT JOIN losses l ON a.artist_id = l.loser_id
)
 SELECT 
   r.artist_id,
   r.artist_name,
   r.wins,
   r.losses,
   r.wins / (r.wins + r.losses) AS win_rate
   FROM record r
WHERE (r.wins + r.losses) > 0
