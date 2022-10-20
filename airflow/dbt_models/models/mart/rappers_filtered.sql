SELECT
    artist_id,
    artist_name,
    popularity,
    followers,
    genres,
    image_url,
    load_date
FROM {{ ref('rappers') }}
WHERE is_valid_genre = TRUE
AND is_excluded_genre = FALSE
AND popularity > 60
AND followers > 100000
