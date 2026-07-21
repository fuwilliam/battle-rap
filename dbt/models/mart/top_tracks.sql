SELECT 
    artist_id,
    track_rank,
    track_name,
    track_id,
    track_url,
    playcount,
    load_date
FROM {{ ref('stg_top_tracks') }}