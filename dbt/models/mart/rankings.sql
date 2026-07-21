-- Leaderboard: win/loss standings joined with the artist's current stats.
-- Backs the web app's /ranking page (getRanking()).
SELECT
    s.artist_id,
    s.artist_name,
    r.monthly_listeners,
    r.followers,
    s.wins,
    s.losses,
    s.win_rate
FROM {{ ref('standings') }} AS s
LEFT JOIN {{ ref('rappers') }} AS r USING (artist_id)
