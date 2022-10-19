SELECT 
    artist_id,
    artist_name,
    popularity,
    followers,
    image_url,
    DATETIME((TIMESTAMP_SECONDS(CAST(load_date AS INT64))), 'UTC') AS load_date
FROM {{ source('raw', 'rappers') }}
