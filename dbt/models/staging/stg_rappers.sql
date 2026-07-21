SELECT
    artist_id,
    artist_name,
    monthly_listeners,
    followers,
    world_rank,
    seeds,
    flag_core_genre,
    image_url,
    CAST(load_date AS TIMESTAMP) AS load_date
FROM {{ source('raw', 'rappers') }}
