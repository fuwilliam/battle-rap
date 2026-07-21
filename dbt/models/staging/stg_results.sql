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
        CAST(voted_at AS TIMESTAMP) AS voted_at,
        ROW_NUMBER() OVER(PARTITION BY winner_id, loser_id, CAST(voted_at AS TIMESTAMP)) AS row_number
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