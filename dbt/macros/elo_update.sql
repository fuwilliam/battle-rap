{#
  One Elo update step as a scalar expression: take `prev`'s
  MAP(artist_id -> rating), apply the match sitting in `nxt`, return the new
  MAP. Only the two entries that played change; everyone else is carried
  forward untouched.

  Callers must expose:
    <prev>.ratings                          MAP(VARCHAR, DOUBLE)
    <nxt>.winner_id, .loser_id, .k_factor

  Every artist starts at 1500 the moment they play their first match, hence the
  coalesce()s -- a first appearance is an insert into the map, not a miss.

  Lives in a macro because three places replay Elo (mart.elo, mart.elo_daily,
  analyses/elo_full_replay.sql) and a formula that drifts between them would
  produce checkpoints that silently disagree with the head.
#}
{% macro elo_update(prev, nxt) %}
map_from_entries(
    list_concat(
        -- carry every other artist's rating forward untouched
        list_filter(
            map_entries({{ prev }}.ratings),
            lambda entry: entry.key NOT IN ({{ nxt }}.winner_id, {{ nxt }}.loser_id)
        ),
        -- ...and replace (or add, on a first appearance) the two that played
        [
            {
                'key': {{ nxt }}.winner_id,
                'value':
                    coalesce({{ prev }}.ratings[{{ nxt }}.winner_id], 1500) + {{ nxt }}.k_factor * (
                        1 - 1.0 / (1 + power(
                            10,
                            (coalesce({{ prev }}.ratings[{{ nxt }}.loser_id], 1500)
                                - coalesce({{ prev }}.ratings[{{ nxt }}.winner_id], 1500)) / 400.0
                        ))
                    )
            },
            {
                'key': {{ nxt }}.loser_id,
                'value':
                    coalesce({{ prev }}.ratings[{{ nxt }}.loser_id], 1500) + {{ nxt }}.k_factor * (
                        0 - 1.0 / (1 + power(
                            10,
                            (coalesce({{ prev }}.ratings[{{ nxt }}.winner_id], 1500)
                                - coalesce({{ prev }}.ratings[{{ nxt }}.loser_id], 1500)) / 400.0
                        ))
                    )
            }
        ]
    )
)
{% endmacro %}
