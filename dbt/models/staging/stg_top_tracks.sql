SELECT 
    artist_id,
    track_rank,
    track_name,
    track_id,
    track_url,
    preview_url,
    DATETIME((TIMESTAMP_SECONDS(CAST(load_date AS INT64))), 'UTC') AS load_date
FROM {{ source('raw', 'top_tracks') }}
