{{
    config(
        materialized='incremental',
        unique_key='bracket_result_id'
    )
}}
-- Unlike raw.results, raw.bracket_results has no natural per-row id (see
-- recordBracketVote in frontend/lib/data.ts), so hash the natural key into
-- one for incremental merging.
WITH results AS
(
    SELECT
        md5(run_id || winner_id || loser_id || CAST(voted_at AS VARCHAR)) AS bracket_result_id,
        run_id,
        matches_in_round,
        winner_id,
        loser_id,
        CAST(voted_at AS TIMESTAMP) AS voted_at,
        ROW_NUMBER() OVER (PARTITION BY run_id, winner_id, loser_id, CAST(voted_at AS TIMESTAMP)) AS row_number
    FROM {{ source('raw', 'bracket_results') }}
)
SELECT
    bracket_result_id,
    run_id,
    matches_in_round,
    winner_id,
    loser_id,
    voted_at
FROM results
WHERE row_number = 1
{% if is_incremental() %}
    AND voted_at > (select coalesce(max(voted_at), timestamp '1900-01-01') from {{ this }})
{% endif %}
