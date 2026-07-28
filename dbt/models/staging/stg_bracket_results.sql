{{
    config(
        materialized='incremental',
        unique_key='bracket_result_id'
    )
}}
-- Unlike raw.results, raw.bracket_results has no natural per-row id (see
-- recordBracketVote in frontend/lib/data.ts), so hash the natural key into
-- one for incremental merging.
with results as (
    select
        md5(run_id || winner_id || loser_id || cast(voted_at as varchar)) as bracket_result_id,
        run_id,
        matches_in_round,
        winner_id,
        loser_id,
        cast(voted_at as timestamp) as voted_at,
        row_number() over (partition by run_id, winner_id, loser_id, cast(voted_at as timestamp)) as row_number
    from {{ source('raw', 'bracket_results') }}
)

select
    bracket_result_id,
    run_id,
    matches_in_round,
    winner_id,
    loser_id,
    voted_at
from results
where row_number = 1
{% if is_incremental() %}
    AND voted_at > (select coalesce(max(voted_at), timestamp '1900-01-01') from {{ this }})
{% endif %}
