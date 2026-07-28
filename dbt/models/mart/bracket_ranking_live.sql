{{ config(materialized='view') }}
-- Live bracket leaderboard: proven bracket win rate + championships + Final
-- Four appearances. Backs /ranking's bracket table (getBracketRanking()).
--
-- A view over raw.bracket_results for the same reason as ranking_live -- see
-- that model for why staging is bypassed.
--
-- Round identification is by matches_in_round, since that's what the vote
-- recorder writes: 1 means the Final (one match left), 2 means the semifinals.
-- Both semifinalists count as a Final Four appearance, win or lose.
--
-- No ORDER BY: an outer SELECT isn't guaranteed to preserve a view's internal
-- ordering, so callers sort explicitly.
with wins as (
    select
        winner_id as artist_id,
        count(*) as wins
    from {{ source('raw', 'bracket_results') }}
    group by 1
),

losses as (
    select
        loser_id as artist_id,
        count(*) as losses
    from {{ source('raw', 'bracket_results') }}
    group by 1
),

championships as (
    select
        winner_id as artist_id,
        count(*) as championships
    from {{ source('raw', 'bracket_results') }}
    where matches_in_round = 1
    group by 1
),

final_four_appearances as (
    select
        artist_id,
        count(*) as final_fours
    from (
        select winner_id as artist_id
        from {{ source('raw', 'bracket_results') }}
        where matches_in_round = 2

        union all

        select loser_id as artist_id
        from {{ source('raw', 'bracket_results') }}
        where matches_in_round = 2
    )
    group by 1
)

select
    rap.artist_id,
    rap.artist_name,
    rap.monthly_listeners,
    rap.image_url,
    coalesce(title_counts.championships, 0) as championships,
    coalesce(final_four_counts.final_fours, 0) as final_fours,
    coalesce(win_counts.wins, 0) as wins,
    coalesce(loss_counts.losses, 0) as losses,
    coalesce(win_counts.wins, 0)::double
    / nullif(coalesce(win_counts.wins, 0) + coalesce(loss_counts.losses, 0), 0) as win_rate,
    coalesce(elo_ratings.elo_rating, 1500) as elo_rating
from {{ ref('rappers') }} as rap
left join wins as win_counts on rap.artist_id = win_counts.artist_id
left join losses as loss_counts on rap.artist_id = loss_counts.artist_id
left join championships as title_counts on rap.artist_id = title_counts.artist_id
left join final_four_appearances as final_four_counts on rap.artist_id = final_four_counts.artist_id
left join {{ ref('elo') }} as elo_ratings on rap.artist_id = elo_ratings.artist_id
-- must have actually played a bracket match
where coalesce(win_counts.wins, 0) + coalesce(loss_counts.losses, 0) > 0
