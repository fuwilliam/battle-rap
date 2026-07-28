{{
    config(
        materialized='incremental',
        unique_key='matchup_id'
    )
}}
with results as (
    select
        matchup_id,
        winner_id,
        loser_id,
        cast(voted_at as timestamp) as voted_at,
        row_number() over (partition by winner_id, loser_id, cast(voted_at as timestamp)) as row_number
    from {{ source('raw', 'results') }}
)

select
    matchup_id,
    winner_id,
    loser_id,
    voted_at
from results
where row_number = 1
{% if is_incremental() %}
    -- coalesce so an empty table (max = NULL) loads everything, not nothing
    AND voted_at > (select coalesce(max(voted_at), timestamp '1900-01-01') from {{ this }})
{% endif %}
