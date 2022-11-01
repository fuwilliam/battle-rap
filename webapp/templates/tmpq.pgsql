
WITH artists AS
(
    SELECT
        artist_id,
        artist_name,
        popularity,
        followers,
        load_date
    FROM rappers
    WHERE
        TRUE
        AND flag_main_genre = TRUE
        AND flag_excl_genre = FALSE
        AND flag_latin_genre = FALSE
        AND popularity >= 60
        AND followers >= 100000
),
wins AS (
    SELECT 
        matchup_id,
        winner_id
    FROM results
),
losses AS (
    SELECT 
        matchup_id,
        loser_id
    FROM results
)
SELECT
    a.artist_id,
    a.artist_name,
    a.popularity,
    a.followers,
    COUNT(w.matchup_id) AS wins,
    COUNT(l.matchup_id) AS losses,
    COUNT(w.matchup_id) / NULLIF((COUNT(l.matchup_id) + COUNT(w.matchup_id)), 0) AS win_rate
FROM artists AS a
LEFT JOIN wins AS w
    ON a.artist_id = w.winner_id
LEFT JOIN losses AS l
    ON a.artist_id = l.loser_id
GROUP BY 1, 2, 3, 4
ORDER BY 5 DESC



