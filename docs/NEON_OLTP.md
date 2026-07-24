# Neon as the OLTP Backend — Design Notes (parked, not implemented)

Written 2026-07-24. Not started — this is a plan to pick up later, not a
description of current behavior.

## Why

DuckDB/MotherDuck is single-writer (see the comment in
`frontend/lib/motherduck.ts` about connections not handling concurrent
statements) — fine for a casual-traffic side project, but a poor fit for
concurrent transactional writes if this ever gets a real traffic spike (e.g.
a viral link). DuckDB/MotherDuck should stay purely analytical; live vote
writes should move to a real OLTP database.

## Plan

- **Neon** (serverless Postgres) as the OLTP store, holding just the votes
  ledger: the `raw.results`-equivalent (casual head-to-head) and
  `raw.bracket_results`-equivalent (bracket matches) tables.
  - Free tier is comfortably enough at this project's scale: votes rows are
    ~100 bytes each, so even 100k votes is ~10MB against the 500MB limit;
    write volume is nowhere near the 100 CU-hour/month compute allowance.
    No credit card required. Only real cost: a few hundred ms of cold-start
    latency on the first vote after Neon scales to zero from idle.
  - Connect via the Vercel Marketplace Postgres integration (Vercel Postgres
    itself is deprecated/folded into Neon as of Dec 2024) for auto-injected
    env vars — same zero-friction pattern as the current MotherDuck setup.
- `/api/vote` and bracket vote recording write to Neon instead of directly to
  MotherDuck's `raw.*` tables.
- A periodic sync job (same shape as `ingestion/load_rappers.py`'s GitHub
  Actions cron) pulls new rows from Neon since last sync into MotherDuck's
  `raw.results`/`raw.bracket_results`, then `dbt build` recomputes
  `stg_results`/`stg_bracket_results`/`standings`/`mart.elo` as today.
- `getMatchup()` (reads `mart.rappers_filtered`) is unaffected — that's a
  read-heavy analytical query MotherDuck is well-suited for either way.

## Open question: ranking freshness

`getRanking()`/`getBracketRanking()` currently aggregate straight from
MotherDuck's `raw.results` for instant-on-vote freshness (see the comment in
`frontend/lib/data.ts`). Two options once votes live in Neon:

1. **Keep it live** — point those aggregate queries at Neon directly instead
   of MotherDuck (trivial COUNT/GROUP BY at this data size, Postgres handles
   it fine). `elo_rating` still only refreshes per dbt run either way (it's
   inherently sequential, see `dbt/models/mart/elo.sql`), same as now.
2. **Let it lag** — read wins/losses from the synced MotherDuck copy too,
   accepting the same sync-cadence lag as Elo. Simpler (one data path for
   the whole ranking page), but is a regression from today's instant-on-vote
   win/loss counts.

Leaning toward (1): keep win/loss counts live off Neon, keep Elo lagging
(unavoidable), don't regress freshness for a win/loss stat that's cheap to
query live.
