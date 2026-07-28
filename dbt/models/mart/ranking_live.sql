{{ config(materialized='view') }}
-- Live head-to-head leaderboard. Backs /ranking (getRanking()).
--
-- A view, not a table, so it's evaluated at query time: a vote cast a second
-- ago is already counted. That's the point -- standings move without waiting
-- for a dbt run.
--
-- Reads raw.results directly rather than stg_results on purpose. stg_results is
-- an incremental TABLE, only refreshed by a dbt run, so building on it would
-- freeze the board between runs. That bypass is inherent to wanting live
-- counts; keeping it here rather than in the app means it's version-controlled,
-- tested, and visible in the dbt docs.
--
-- elo_rating is the one column that stays run-bound -- Elo is sequential (see
-- elo.sql), so it can't be recomputed per request.
--
-- No ORDER BY: an outer SELECT isn't guaranteed to preserve a view's internal
-- ordering, so callers sort explicitly.
with wins as (
    select
        winner_id as artist_id,
        count(*) as wins
    from {{ source('raw', 'results') }}
    group by 1
),

losses as (
    select
        loser_id as artist_id,
        count(*) as losses
    from {{ source('raw', 'results') }}
    group by 1
)

select
    rap.artist_id,
    rap.artist_name,
    rap.monthly_listeners,
    rap.image_url,
    coalesce(win_counts.wins, 0) as wins,
    coalesce(loss_counts.losses, 0) as losses,
    coalesce(win_counts.wins, 0)::double
    / nullif(coalesce(win_counts.wins, 0) + coalesce(loss_counts.losses, 0), 0) as win_rate,
    coalesce(elo_ratings.elo_rating, 1500) as elo_rating
from {{ ref('rappers') }} as rap
left join wins as win_counts on rap.artist_id = win_counts.artist_id
left join losses as loss_counts on rap.artist_id = loss_counts.artist_id
left join {{ ref('elo') }} as elo_ratings on rap.artist_id = elo_ratings.artist_id
-- fewer than 5 matches isn't a record yet
where coalesce(win_counts.wins, 0) + coalesce(loss_counts.losses, 0) >= 5
