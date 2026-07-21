{% snapshot rappers_snapshot %}
    {{
        config(
          target_schema='snapshots',
          strategy='check',
          unique_key='artist_id',
          check_cols=['monthly_listeners'],
        )
    }}

SELECT
  artist_id,
  monthly_listeners,
  followers,
  load_date
FROM {{ ref('rappers_filtered') }}

{% endsnapshot %}