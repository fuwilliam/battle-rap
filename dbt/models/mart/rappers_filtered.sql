{{
    config(
        materialized='incremental',
        unique_key='artist_id'
    )
}}

-- popularity (0-100) is gone; filter on monthly_listeners instead.
SELECT
    artist_id,
    artist_name,
    monthly_listeners,
    followers,
    world_rank,
    seeds,
    image_url,
    load_date
FROM {{ ref('rappers') }}
WHERE flag_core_genre = TRUE
AND monthly_listeners > 1000000
AND followers > 100000

{% if is_incremental() %}
    -- coalesce so an empty table (max = NULL) loads everything, not nothing
    AND load_date > (select coalesce(max(load_date), timestamp '1900-01-01') from {{ this }})
{% endif %}
