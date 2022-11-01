WITH rappers AS (
    SELECT
        artist_id,
        artist_name,
        popularity,
        followers,
        image_url,
        load_date
    FROM {{ ref('stg_rappers') }}
),

genres AS (
    SELECT
        artist_id,
        ARRAY_TO_STRING(genre_array, ", ") AS genres,
        REGEXP_CONTAINS(ARRAY_TO_STRING(genre_array, ", "), "rap|hip hop|drill|grime|pluggnb|escape room") AS is_valid_genre,
        REGEXP_CONTAINS(ARRAY_TO_STRING(genre_array, ", "), "rap rock|rap metal|reggaeton|hyperpop|electropop") AND NOT REGEXP_CONTAINS(ARRAY_TO_STRING(genre_array, ", "), "hip hop") AS is_excluded_genre,
        REGEXP_CONTAINS(ARRAY_TO_STRING(genre_array, ", "), "latin|argentin|mexican hip hop") AS is_latin_genre
    FROM {{ ref('stg_genres') }}
)

SELECT
    r.artist_id,
    r.artist_name,
    r.popularity,
    r.followers,
    g.genres,
    g.is_valid_genre,
    g.is_excluded_genre,
    g.is_latin_genre,
    r.image_url,
    r.load_date
FROM rappers AS r
LEFT JOIN genres AS g
    ON r.artist_id = g.artist_id
