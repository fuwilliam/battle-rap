SELECT
    artist_id,
    artist_name,
    monthly_listeners,
    followers,
    world_rank,
    seeds,
    flag_core_genre,
    image_url,
    DATETIME((TIMESTAMP_SECONDS(CAST(load_date AS INT64))), 'UTC') AS load_date
FROM {{ source('raw', 'rappers') }}
