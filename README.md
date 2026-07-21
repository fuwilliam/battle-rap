# [battlerap.app](https://battlerap.app)

A project built to answer the quintessential question: who is the greatest rapper?

![Demo](https://github.com/fuwilliam/battle-rap/blob/main/images/demo.png)

## Architecture

1. **Ingest** — artist & track data from Spotify via [`spotapi`](https://github.com/Aran404/SpotAPI) (Spotify's internal web endpoints — no API key, no Premium), seeded by hip-hop genres/playlists. One fetch per artist, parallelized with a thread pool.
2. **Store** — everything lands in [MotherDuck](https://motherduck.com/) (cloud DuckDB): `raw`, `staging`, and `mart` schemas in a single database.
3. **Transform** — [dbt](https://www.getdbt.com/) (`dbt-duckdb`) builds staging → mart models with tests and snapshots.
4. **Serve** — the web app shows matchups; user picks are written back to MotherDuck.
5. **Orchestrate** — [GitHub Actions](.github/workflows/refresh-rappers.yml) runs the daily ingest + `dbt build` on a cron. Python deps are locked with [uv](https://docs.astral.sh/uv/).

> Previously: Spotify Web API → Supabase → GCS → BigQuery → Power BI, orchestrated by Airflow. Spotify gated the Web API behind an app-owner Premium subscription, so the stack was rebuilt on free foundations (spotapi · MotherDuck · dbt-duckdb · GitHub Actions · uv). The full story + the old architecture are archived in [`docs/HISTORY.md`](docs/HISTORY.md).

## Layout

| Path | What |
|------|------|
| `ingestion/` | spotapi client, artist lister, MotherDuck loader |
| `dbt/` | staging + mart models, tests, snapshots (dbt-duckdb → MotherDuck) |
| `.github/workflows/` | scheduled `refresh-rappers` pipeline |
| `webapp/` | Flask app (being replaced by a Next.js frontend) |

## Run locally

```bash
uv sync

# ingest to a local DuckDB file (no MotherDuck needed)
DUCKDB_LOCAL_PATH=~/br.duckdb uv run python -m ingestion.load_rappers

# build + test models against that file
cd dbt && DBT_DUCKDB_PATH=~/br.duckdb uv run dbt build --profiles-dir .
```

Against MotherDuck: set `motherduck_token` in the environment and drop the `*_PATH` overrides (both loader and dbt default to `md:battlerap`).

## Notes

- **spotapi is unofficial.** If Spotify rotates its internal TOTP secret, ingestion breaks until spotapi ships an update (`uv lock --upgrade-package spotapi`).
- `popularity` (0–100) is no longer exposed by Spotify → replaced by `monthly_listeners`. Per-artist genres are gone → relevance inferred from the discovery seed (`flag_core_genre`).

## Ideas for the future

- Play a song snippet when hovering on an artist picture
- Bracket mode (March Madness style) to crown a champion
- Elo rating or MaxDiff to rank artists
- "World rank" seal on artist cards (`world_rank`)
