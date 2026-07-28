{% snapshot rappers_snapshot %}
    {{
        config(
          target_schema='snapshots',
          strategy='check',
          unique_key='artist_id',
          check_cols=['monthly_listeners'],
        )
    }}

select
    artist_id,
    monthly_listeners,
    followers,
    last_seen_at
from {{ ref('rappers_filtered') }}
{% endsnapshot %}