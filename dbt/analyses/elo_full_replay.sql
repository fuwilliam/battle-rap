-- Drift audit: replay the ENTIRE match history from match #1 with the old
-- (pre-checkpoint) logic and diff it against the checkpointed mart.elo. Any row
-- returned is drift -- the two disagree and the checkpoints are wrong.
--
-- Deliberately an analysis, not a test: this is the O(matches * artists) work the
-- checkpointing exists to avoid, so it must not run on every `dbt build`. Run it
-- by hand after changing the Elo logic, or when you suspect drift:
--
--     dbt compile -s elo_full_replay --profiles-dir .
--     duckdb md:battlerap < target/compiled/battle_rap/analyses/elo_full_replay.sql
--
-- Zero rows = incremental output is bit-for-bit what a from-scratch rebuild
-- would produce. If it isn't:
--     dbt run --full-refresh -s mart.elo_daily+ --profiles-dir .
--
-- Expected legitimate cause of drift: a match arriving with a voted_at older
-- than the watermark. The staging models already drop those on their own
-- watermark (see stg_results.sql), so this should stay empty in practice.
with recursive matches as (
    {{ elo_matches() }}
),

ordered_matches as (
    select
        row_number() over (order by voted_at, winner_id, loser_id) as match_number,
        winner_id,
        loser_id,
        k_factor
    from matches
),

elo_state as (
    -- match_number = 0: nobody's played yet
    select
        0 as match_number,
        map([]::varchar [], []::double []) as ratings

    union all

    select
        nxt.match_number,
        {{ elo_update('prev', 'nxt') }} as ratings
    from elo_state as prev
    inner join ordered_matches as nxt on nxt.match_number = prev.match_number + 1
),

from_scratch as (
    select
        entry.key as artist_id,
        entry.value as elo_rating
    from elo_state, unnest(map_entries(elo_state.ratings)) as rating_entries (entry)
    where elo_state.match_number = (
            select coalesce(max(nxt.match_number), 0) as last_match_number
            from ordered_matches as nxt
        )
)

select
    coalesce(replayed.artist_id, incr.artist_id) as artist_id,
    replayed.elo_rating as full_replay_elo,
    incr.elo_rating as incremental_elo,
    incr.elo_rating - replayed.elo_rating as drift
from from_scratch as replayed
full outer join {{ ref('elo') }} as incr on replayed.artist_id = incr.artist_id
-- float tolerance: the two take different code paths to the same arithmetic, so
-- allow last-bit noise but nothing a rating would actually notice
where replayed.artist_id is null
    or incr.artist_id is null
    or abs(incr.elo_rating - replayed.elo_rating) > 1e-6
order by abs(coalesce(incr.elo_rating - replayed.elo_rating, 0)) desc
