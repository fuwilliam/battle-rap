-- Current Elo, blended across both match types: casual head-to-head votes count
-- as "friendlies" (K=16), bracket matches count as "tournament games" (K=32) --
-- a bracket win moves the needle twice as much, same idea as a classical
-- tournament game mattering more than a casual chess.com blitz. Every artist
-- starts at 1500 the moment they play their first match (of either kind).
--
-- Elo is inherently sequential (each match's update depends on the state left by
-- the previous one), so this can't be one flat aggregate like win_rate. But the
-- rating vector fully summarises everything before it, so history doesn't need
-- replaying: mart.elo_daily holds the vector as of the last closed day, and this
-- model only replays the matches after it -- usually just today's.
--
-- That's the whole point of the split. Replaying all of history was
-- O(matches * artists), not O(matches): each recursion step rebuilds the entire
-- MAP to change two entries, so cost grew with *both* the match count and the
-- roster, i.e. superlinearly in calendar time. Per-run cost is now
-- O(today's matches * artists) and stays flat as history piles up.
with recursive matches as (
    {{ elo_matches() }}
),

checkpoint_date as (
    -- coalesce so a missing/empty elo_daily replays from match #1 rather than
    -- producing nothing -- correct either way, just slower.
    select coalesce(max(as_of_date), date '1900-01-01') as as_of_date
    from {{ ref('elo_daily') }}
),

-- Whatever elo_daily hasn't closed out yet: today, plus any earlier day that
-- slipped through if a run was missed.
new_matches as (
    select
        -- winner_id/loser_id as a tiebreak just makes the order deterministic
        -- for same-timestamp votes -- it doesn't need to mean anything.
        row_number() over (order by mch.voted_at, mch.winner_id, mch.loser_id) as match_number,
        mch.winner_id,
        mch.loser_id,
        mch.k_factor
    from matches as mch, checkpoint_date as chk
    where cast(mch.voted_at as date) > chk.as_of_date
),

seed as (
    select
        coalesce(
            map_from_entries(list({ 'key': dly.artist_id, 'value': dly.elo_rating })),
            map(cast([] as varchar []), cast([] as double []))
        ) as ratings
    from {{ ref('elo_daily') }} as dly, checkpoint_date as chk
    where dly.as_of_date = chk.as_of_date
),

-- Threading the whole ratings table through as a single MAP value keeps this at
-- one row per match rather than one row per artist per match.
elo_state as (
    select
        0 as match_number,
        ratings
    from seed

    union all

    select
        nxt.match_number,
        {{ elo_update('prev', 'nxt') }} as ratings
    from elo_state as prev
    inner join new_matches as nxt on nxt.match_number = prev.match_number + 1
),

final_ratings as (
    select
        entry.key as artist_id,
        entry.value as elo_rating
    from elo_state, unnest(map_entries(elo_state.ratings)) as rating_entries (entry)
    -- No matches since the checkpoint (max = NULL) means the checkpoint itself
    -- is the answer -- that's match_number 0, the seed row.
    where elo_state.match_number = (
            select coalesce(max(nxt.match_number), 0) as last_match_number
            from new_matches as nxt
        )
),

-- Flat aggregate over the full history, and cheap, so it isn't checkpointed.
games_played as (
    select
        artist_id,
        count(*) as games_played
    from (
        select winner_id as artist_id from matches
        union all
        select loser_id as artist_id from matches
    ) as appearances
    group by artist_id
)

select
    fin.artist_id,
    fin.elo_rating,
    gms.games_played
from final_ratings as fin
inner join games_played as gms on fin.artist_id = gms.artist_id
