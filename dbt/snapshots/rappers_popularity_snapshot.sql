{% snapshot rappers_snapshot %}
    {{
        config(
          target_schema='snapshots',
          strategy='check',
          unique_key='artist_id',
          check_cols=['popularity'],
        )
    }}

SELECT 
  artist_id,
  popularity,
  followers,
  load_date
FROM {{ ref('rappers_filtered') }}

{% endsnapshot %}