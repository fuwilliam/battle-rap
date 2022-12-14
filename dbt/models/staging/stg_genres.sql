SELECT 
    artist_id,
    array(select lower(cast(genre as string)) from unnest(split(regexp_replace(genres, '\"|{|}', ''), ",")) genre) as genre_array
FROM {{ source('raw', 'rappers') }}
