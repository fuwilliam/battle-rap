{{
    config(
        materialized='incremental',
        unique_key='matchup_id'
    )
}}
WITH results AS
(
    SELECT 
        matchup_id,
        winner_id,
        loser_id,
        DATETIME((TIMESTAMP_SECONDS(CAST(voted_at AS INT64))), 'UTC') AS voted_at,
        ROW_NUMBER() OVER(PARTITION BY winner_id, loser_id, TIMESTAMP_SECONDS(CAST(voted_at AS INT64))) AS row_number
    FROM {{ source('raw', 'results') }}
)
SELECT
    matchup_id,
    winner_id,
    loser_id,
    voted_at
FROM results
WHERE row_number = 1
{% if is_incremental() %}
    AND voted_at > (select max(voted_at) from {{ this }})
{% endif %}