# dbt (dbt-duckdb → MotherDuck)

Builds `staging` → `mart` on top of the `raw` schema the Python ingestion writes.

```bash
# from this directory
uv run dbt build --profiles-dir .                    # models + tests + snapshot
uv run dbt build --profiles-dir . -s mart.elo+       # one model and everything after it
uv run dbt docs generate --profiles-dir . && uv run dbt docs serve --profiles-dir .
```

Targets MotherDuck (`md:battlerap`) by default, auth from the `motherduck_token`
env var. Point it at a local file to experiment without touching prod:

```bash
DBT_DUCKDB_PATH=/tmp/battlerap.duckdb uv run dbt build --profiles-dir .
```

## Linting

SQLFluff runs from the repo root (config in `../.sqlfluff`, same ruleset as the
`bi-*` BigQuery repos with `dialect = duckdb`):

```bash
cd .. && DBT_DUCKDB_PATH=/tmp/lint.duckdb uv run sqlfluff lint dbt   # CI runs this
cd .. && DBT_DUCKDB_PATH=/tmp/lint.duckdb uv run sqlfluff fix dbt    # rewrite in place
```

It uses the **dbt templater**, so linting compiles the project — hence the
throwaway `DBT_DUCKDB_PATH` (no MotherDuck token needed; compiling reads no data).
Two consequences worth knowing:

- Only the branch that *would build right now* gets linted. In `elo_daily.sql` the
  `{% if is_incremental() %}` side is invisible to SQLFluff on a fresh database, so
  keep both branches styled by hand.
- `max_parse_depth` is raised in `.sqlfluff`; the recursive Elo CTEs nest past the
  stock 255-level guard and would otherwise be reported as unparseable.

## Things that will bite you

- **`mart.elo_daily` caches formula output.** Change the K factors or
  `macros/elo_update.sql` and existing checkpoints are stale without dbt noticing:
  `uv run dbt run --full-refresh -s mart.elo_daily+ --profiles-dir .`
- **`raw.rappers` / `raw.top_tracks` are append-only.** Staging collapses them to
  each artist's latest snapshot; `mart.rappers_filtered` retires artists unseen for
  14 days. A failed scrape no longer deletes anyone.
- **`analyses/elo_full_replay.sql`** is the drift audit for that checkpointing.
  It's an analysis, not a test, because it's the O(matches × artists) work the
  checkpoints exist to avoid. Run it by hand after touching the Elo math.
