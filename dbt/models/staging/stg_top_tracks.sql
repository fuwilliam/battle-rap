SELECT 
    artist_id,
    track_rank,
    track_name,
    track_id,
    track_url,
    playcount,
    CAST(load_date AS TIMESTAMP) AS load_date
FROM {{ source('raw', 'top_tracks') }}
