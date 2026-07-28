{{
    config(
        materialized='incremental',
        unique_key=['as_of_date', 'artist_id']
    )
}}
-- Daily Elo checkpoints: the full rating vector as it stood at the close of
-- each day that had matches.
--
-- Why this exists: Elo is sequential, but the rating vector is a *complete*
-- summary of every match before it -- nothing else from history is needed to
-- keep going. So any saved vector is a valid resume point, which lets mart.elo
-- replay only today instead of all of history on every dbt run.
--
-- Append-only by construction: `current_date` is excluded, so a row here is
-- never rewritten once written. Today's still-moving state lives in mart.elo.
--
-- Also doubles as an Elo-over-time series (one vector per active day), which is
-- what any rating-trend chart should read from rather than recomputing.
--
-- IMPORTANT: this table caches the *output* of the Elo formula. Change the K
-- factors here or the math in macros/elo_update.sql and every existing
-- checkpoint becomes stale without dbt noticing. Rebuild explicitly:
--     dbt run --full-refresh -s mart.elo_daily+
with recursive matches as (
    {{ elo_matches() }}
),

-- Everything on or before this date is already checkpointed and immutable.
watermark as (
    {% if is_incremental() %}
        -- coalesce so an empty table (max = NULL) replays everything, not nothing
        select coalesce(max(as_of_date), date '1900-01-01') as as_of_date from {{ this }}
    {% else %}
    select date '1900-01-01' as as_of_date
    {% endif %}
),

new_matches as (
    select
        -- winner_id/loser_id as a tiebreak just makes the order deterministic
        -- for same-timestamp votes -- it doesn't need to mean anything.
        row_number() over (order by mch.voted_at, mch.winner_id, mch.loser_id) as match_number,
        cast(mch.voted_at as date) as match_date,
        mch.winner_id,
        mch.loser_id,
        mch.k_factor
    from matches as mch, watermark as wtm
    where cast(mch.voted_at as date) > wtm.as_of_date
        -- Today can still receive votes, so freezing it now would drop every
        -- vote cast after this run: the next run's watermark would already be
        -- today, and `> watermark` would skip them forever. Checkpoint it
        -- tomorrow, once it can't change.
        and cast(mch.voted_at as date) < current_date
),

seed as (
    {% if is_incremental() %}
        -- Resume from the last checkpoint instead of match #1. Aggregating with
        -- no GROUP BY still yields one row when the table is empty, so the
        -- coalesce turns "no checkpoint yet" into an empty map.
        -- NB: sqlfluff only ever sees ONE side of this branch (the dbt templater
        -- renders the model as it would build right now), so keep both hands
        -- styled the same by eye -- the linter can't do it for you.
        select coalesce(
            map_from_entries(list({ 'key': ckp.artist_id, 'value': ckp.elo_rating })),
            map(cast([] as varchar []), cast([] as double []))
        ) as ratings
        from {{ this }} as ckp, watermark as wtm
        where ckp.as_of_date = wtm.as_of_date
    {% else %}
    -- nobody's played yet
    select map(cast([] as varchar []), cast([] as double [])) as ratings
    {% endif %}
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

-- the state after a day's last match *is* that day's closing checkpoint
day_ends as (
    select
        match_date,
        max(match_number) as match_number
    from new_matches
    group by match_date
),

day_end_state as (
    select
        day_rows.match_date,
        sts.ratings
    from day_ends as day_rows
    inner join elo_state as sts on day_rows.match_number = sts.match_number
)

select
    dst.match_date as as_of_date,
    entry.key as artist_id,
    entry.value as elo_rating
from day_end_state as dst, unnest(map_entries(dst.ratings)) as rating_entries (entry)
