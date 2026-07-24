# Genre Filter — Design Notes & Session Log

How battle-rap decides who counts as a "rapper," why it works the way it does,
and the open edge cases. Written 2026-07-22.

## Why this is hard

Spotify killed per-artist `genres` in their API (and we now read via `spotapi`,
which never exposed them). So we cannot ask "is this artist hip-hop?" directly.
Genre is *inferred* from two signals:

1. **Discovery seed** — which search term / playlist surfaced the artist
   (`ingestion/spotify_dicts.py`: `genre_dict` keyword searches + `playlist_dict`
   curated playlists). The seed is stored on each artist.
2. **Related-artist graph** — "rappers relate to rappers." An artist's Spotify
   related-artists list is used as a genre signal.

## The two gates

- **Gate 1 — ingestion graph filter** (`ingestion/artist_lister.py::enrich`):
  decides who lands in `raw.rappers` at all. This is where off-genre artists
  are dropped.
- **Gate 2 — `mart.rappers_filtered`** (dbt): eligibility for **matchups** only.
  `flag_core_genre = TRUE AND monthly_listeners > 1M AND followers > 100k`.
  Full-refresh **table** (was incremental) so artists who drop out actually
  disappear from matchups instead of lingering.

## Data-source map (important)

- **Matchups** (`getMatchup`) read `mart.rappers_filtered` (thresholded pool).
- **Ranking** (`getRanking`) reads `mart.rappers` (ALL ingested artists, **no**
  threshold) LEFT JOIN vote counts from `raw.results`, `WHERE matchups >= 5`.
  - Consequence: falling **below the listener threshold does NOT strand ranking
    data** — the threshold lives only in the matchup pool.
  - Real exposure: `raw.rappers` is `CREATE OR REPLACE` each ingest, so an artist
    who drops out of **ingestion entirely** (genre-filtered out / no longer on any
    seed) vanishes from the ranking. Their **votes are never lost** (`raw.results`
    is append-only) — only the renderable row (name/image/listeners) disappears.
  - Parked fix if churn ever bites: an accumulating `dim_rappers` dimension
    (upsert every artist ever ingested, never delete) that `getRanking` joins to.

## Evolution of Gate 1 this session

1. **Baseline graph filter** — keep artist iff ≥1 of their related artists is in
   the discovered pool (outward overlap ≥ 1). Threshold 2 dropped real rappers
   (e.g. NF) in a small pool; threshold 1 chosen.
2. **Option A "trust playlists" (PR #28)** — playlist-sourced artists skipped the
   filter entirely (curated = trusted). **Bug:** Spotify lists non-rap *guests* on
   curated rap playlists — **Peter Gabriel** is a featured artist on one track
   ("Beyond The Brilliant Haze", w/ rapper IDK) on the *Alternative Hip-Hop*
   playlist. His related graph is 100% classic rock (Genesis, Yes, Talk Talk),
   zero rap peers, but trust let him through.
3. **Mutual relatedness (PR #30, MERGED)** — current production logic. Drop the
   trust exemption; filter **every** artist, but check relatedness in **both
   directions** against the pool:
   - **outward** — artist relates to ≥1 pool member, OR
   - **inward** — ≥1 pool member relates back (in-degree ≥ 1).
   Keep if either holds. Inward rescues real rappers whose own peers aren't in the
   pool yet (Young Dro, Atmosphere) while dropping graph-disconnected off-genre
   artists (Peter Gabriel, Raphaela Santos, Reneé Rapp).
   - Rejected alternative: **2-hop union** (`pool ∪ pool's-related`) — too lenient,
     re-admitted Peter Gabriel, Raphaela, AND Reneé Rapp via leftfield bridges.
   - Validated live (~547 pool): ~114 dropped / ~433 kept; all marquee + underground
     rappers kept, the off-genre trio dropped.

## OPEN ISSUE — search-clique noise (undecided)

After PR #30, two outliers still appear in matchups: **Slipknot** and **j-hope**.
Traced the cause — it is **not** legit crossover, it is **self-vouching cliques**
that enter via the fuzzy keyword searches:

- **Slipknot** (`seed=['rap']`, from the `"rap"` search) is vouched in/out by
  **Korn, System Of A Down, Limp Bizkit, Deftones, Linkin Park** — the whole
  nu-metal cluster, all `seed=['rap']`, all entered via the same search. They vouch
  for *each other*, so mutual-relatedness can't tell them apart from real rappers.
- **j-hope** (`seed=['hip hop']`) is vouched only by **RM** (other BTS rapper).

So the `"rap"` / `"hip hop"` keyword searches drag in famous off-genre acts that
form tight related-clusters and survive the mutual filter. (Implies Linkin Park,
Korn, etc. are also in the pool as "rappers.")

### Candidate fix tested: playlist-anchored trust

Rule: keep iff artist is **core** (on a curated playlist) OR connects (in/out) to
a **core** artist. Noise cliques contain no playlist members → collapse.

Test result (`anchored` vs current `mutual`, ~549 pool, core=331):

- DROPS correctly: Slipknot, j-hope, Korn, System Of A Down, Limp Bizkit,
  Deftones, RM, Bad Bunny.
- **Not clean, though:**
  - **Linkin Park still KEPT** (anchored=K) — it has a core-playlist neighbor.
  - **Atmosphere gets DROPPED** (anchored=D) — collateral; real rapper, false neg.
- Counts: mutual kept 437 vs anchored kept 427.

**Verdict:** anchor rule catches most metal/k-pop noise but is not a clean win —
Linkin Park slips through and Atmosphere is wrongly dropped. Needs refinement
before shipping. Possible directions: require ≥2 core neighbors; combine mutual
AND anchor; or a small manual allowlist to rescue known-good collateral
(Atmosphere) once the rule is otherwise tuned. **Decision pending — not
implemented.**

## Key files

- `ingestion/artist_lister.py` — `combine_artists` (discovery), `enrich` (Gate 1
  mutual filter, current production logic).
- `ingestion/spotify_client.py` — spotapi access; `fetch_artist` returns
  `{artist, top_tracks, related}`.
- `ingestion/spotify_dicts.py` — `genre_dict`, `playlist_dict`, `loose_seeds`,
  `denylist` (kept empty on purpose as a manual-override escape hatch).
- `dbt/models/mart/rappers_filtered.sql` — Gate 2, full-refresh table.
- `dbt/models/mart/rappers.sql` — thresholdless, feeds the ranking.
- `frontend/lib/data.ts` — `getMatchup` (rappers_filtered), `getRanking`
  (rappers + raw.results).

## Diagnostic recipe

To trace why any artist passed/failed Gate 1: run discovery + enrich, then for the
target print (a) their related that are in the pool [outward] and (b) pool artists
whose related include them [inward], with each voucher's seeds. A self-vouching
clique shows up as vouchers that all share the same single keyword seed and no
curated-playlist seed. (Scripts were run ad hoc from the scratchpad this session.)
