{{
    config(
        materialized='incremental',
        unique_key='artist_id'
    )
}}

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
AND is_latin_genre = FALSE
AND popularity > 70
AND followers > 100000

{% if is_incremental() %}
    AND load_date > (select max(load_date) from {{ this }})
{% endif %}
