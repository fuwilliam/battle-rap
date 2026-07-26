{#
  Every match that feeds Elo, from both sources, with its K factor attached:
  casual head-to-head votes are "friendlies" (K=16), bracket matches are
  "tournament games" (K=32).

  Shared by mart.elo, mart.elo_daily and analyses/elo_full_replay.sql so the
  three can't disagree about what counts as a match.
#}
{% macro elo_matches() %}
SELECT winner_id, loser_id, voted_at, 16.0 AS k_factor
FROM {{ ref('stg_results') }}

UNION ALL

SELECT winner_id, loser_id, voted_at, 32.0 AS k_factor
FROM {{ ref('stg_bracket_results') }}
{% endmacro %}
