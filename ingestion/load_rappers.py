#!/usr/bin/env python
# coding: utf-8
"""Ingest Spotify artists + top tracks into MotherDuck (raw schema).

Run from the repo root:  python -m ingestion.load_rappers
"""

import os
import time
from datetime import datetime

import duckdb
import pyarrow as pa
from dotenv import load_dotenv

import ingestion.spotify_dicts
from ingestion.artist_lister import ArtistLister

load_dotenv()

# Target is MotherDuck (cloud DuckDB); auth via the `motherduck_token` env var.
MOTHERDUCK_DATABASE = os.getenv("MOTHERDUCK_DATABASE", "battlerap")

genre_dict = ingestion.spotify_dicts.genre_dict
playlist_dict = ingestion.spotify_dicts.playlist_dict


def _int(v):
    """Spotify play counts come as numeric strings; coerce to int or None."""
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def compile_artists(lister, genres, playlists):
    print("Compiling artist list...")
    return lister.combine_artists(genres, playlists)


# Spelled out rather than inferred: an all-NULL column (every artist missing a
# listener count, every playcount unparseable) infers as Arrow's null type, and
# the INSERT then fails on a type it can't match to the target column.
_RAPPERS_SCHEMA = pa.schema(
    [
        ("artist_id", pa.string()),
        ("artist_name", pa.string()),
        ("monthly_listeners", pa.int64()),
        ("followers", pa.int64()),
        ("world_rank", pa.int64()),
        ("image_url", pa.string()),
        ("seeds", pa.string()),
        ("flag_core_genre", pa.bool_()),
        ("load_date", pa.timestamp("us")),
    ]
)

_TOP_TRACKS_SCHEMA = pa.schema(
    [
        ("artist_id", pa.string()),
        ("track_rank", pa.int64()),
        ("track_name", pa.string()),
        ("track_id", pa.string()),
        ("track_url", pa.string()),
        ("playcount", pa.int64()),
        ("load_date", pa.timestamp("us")),
    ]
)


def _bulk_insert(con, table, columns, schema):
    """Load a column dict into `table` as ONE Arrow-backed INSERT.

    NOT executemany(): that issues a separate INSERT per row. Free against a
    local file, brutal against MotherDuck where every statement is a network
    round trip -- measured in CI at ~150ms/row, so 4.7k rows took 714s while the
    Spotify enrichment that produced them took 18s.

    DuckDB scans the Arrow table in place (zero copy) and MotherDuck's hybrid
    execution ships the result columnar, so the row count stops mattering: one
    statement, no SQL text to build, and Arrow carries the types instead of
    inferring them from placeholders.
    """
    arrow_table = pa.table(columns, schema=schema)
    if arrow_table.num_rows == 0:
        return
    # bound to a name so the replacement scan can find it, then dropped -- a
    # lingering registration would shadow a real table of the same name
    con.register("_bulk_load", arrow_table)
    try:
        con.execute(f"INSERT INTO {table} SELECT * FROM _bulk_load")
    finally:
        con.unregister("_bulk_load")


def connect_motherduck():
    """Open the DuckDB target.

    Uses a local .duckdb file if DUCKDB_LOCAL_PATH is set (handy for testing),
    otherwise MotherDuck (`md:` path; token from the `motherduck_token` env).
    """
    local = os.getenv("DUCKDB_LOCAL_PATH")
    if local:
        return duckdb.connect(local)
    # MotherDuck doesn't auto-create the db; connect to the account root,
    # create it if missing, then switch into it.
    con = duckdb.connect("md:")
    con.execute(f"CREATE DATABASE IF NOT EXISTS {MOTHERDUCK_DATABASE}")
    con.execute(f"USE {MOTHERDUCK_DATABASE}")
    return con


def load_to_db(rapper_rows, track_rows, con):
    start_time = time.perf_counter()
    print("Loading raw tables to MotherDuck...")

    con.execute("CREATE SCHEMA IF NOT EXISTS raw")

    # One timestamp for the entire run, carried as a column value. It must NOT be
    # a `now()` in the SQL, which gets evaluated per row and gave all 5000 track
    # rows distinct microsecond stamps -- staging picks each artist's latest
    # snapshot by load_date, so "latest" collapsed to a single track per artist
    # instead of their top 10.
    run_ts = datetime.now()

    # The raw tables are APPEND-ONLY: one snapshot row per artist per run, every
    # row of that run sharing run_ts. They used to be CREATE OR REPLACE, which
    # meant a single transient Spotify failure during enrichment erased that
    # artist everywhere downstream -- the 2026-07-27 run silently dropped Pusha T
    # and 28 others out of the battle pool. Keeping history lets stg_rappers fall
    # back to an artist's last good observation and age them out on last_seen_at
    # instead (see mart/rappers_filtered.sql). ~600 rows/day is nothing to store.
    #
    # Re-running on the same day replaces that day's rows rather than stacking
    # a second snapshot, so a manual re-run stays idempotent.
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS raw.rappers (
            artist_id         VARCHAR,
            artist_name       VARCHAR,
            monthly_listeners BIGINT,
            followers         BIGINT,
            world_rank        BIGINT,
            image_url         VARCHAR,
            seeds             VARCHAR,
            flag_core_genre   BOOLEAN,
            load_date         TIMESTAMP
        )
        """
    )
    if rapper_rows:
        con.execute("DELETE FROM raw.rappers WHERE load_date::DATE = current_date")
        _bulk_insert(
            con,
            "raw.rappers",
            {
                "artist_id": [r["artist_id"] for r in rapper_rows],
                "artist_name": [r["artist_name"] for r in rapper_rows],
                "monthly_listeners": [r["monthly_listeners"] for r in rapper_rows],
                "followers": [r["followers"] for r in rapper_rows],
                "world_rank": [r["world_rank"] for r in rapper_rows],
                "image_url": [r["image_url"] for r in rapper_rows],
                "seeds": [r["seeds"] for r in rapper_rows],
                "flag_core_genre": [r["flag_core_genre"] for r in rapper_rows],
                "load_date": [run_ts] * len(rapper_rows),
            },
            _RAPPERS_SCHEMA,
        )

    # append-only for the same reason as raw.rappers -- and it has to be, or an
    # artist kept alive by the staleness window would show up in a battle with
    # no tracks and no hover preview at all.
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS raw.top_tracks (
            artist_id  VARCHAR,
            track_rank BIGINT,
            track_name VARCHAR,
            track_id   VARCHAR,
            track_url  VARCHAR,
            playcount  BIGINT,
            load_date  TIMESTAMP
        )
        """
    )
    if track_rows:
        con.execute("DELETE FROM raw.top_tracks WHERE load_date::DATE = current_date")
        _bulk_insert(
            con,
            "raw.top_tracks",
            {
                "artist_id": [t["artist_id"] for t in track_rows],
                "track_rank": [t["track_rank"] for t in track_rows],
                "track_name": [t["track_name"] for t in track_rows],
                "track_id": [t["track_id"] for t in track_rows],
                "track_url": [t["track_url"] for t in track_rows],
                "playcount": [_int(t["playcount"]) for t in track_rows],
                "load_date": [run_ts] * len(track_rows),
            },
            _TOP_TRACKS_SCHEMA,
        )

    # votes are written by the webapp; make sure the table exists so dbt's
    # results/standings models don't fail on a fresh database.
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS raw.results (
            matchup_id VARCHAR,
            winner_id  VARCHAR,
            loser_id   VARCHAR,
            voted_at   TIMESTAMP
        )
        """
    )

    # bracket-mode votes, kept separate from raw.results: bracket matchups are
    # seeded (not random), so mixing them into raw.results would skew the
    # head-to-head win-rate leaderboard. matches_in_round records how many
    # matches were being played in that round (2 = Final Four, 1 = the Final),
    # which is all getBracketRanking needs to derive championships/Final Fours.
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS raw.bracket_results (
            run_id           VARCHAR,
            matches_in_round BIGINT,
            winner_id        VARCHAR,
            loser_id         VARCHAR,
            voted_at         TIMESTAMP
        )
        """
    )

    duration = time.perf_counter() - start_time
    print(f"Loaded {len(rapper_rows)} rappers, {len(track_rows)} tracks in {duration:.2f}s")


def main():
    lister = ArtistLister()

    combined_artists = compile_artists(lister, genre_dict, playlist_dict)

    print(f"Enriching {len(combined_artists)} artists (parallel)...")
    start_time = time.perf_counter()
    rapper_rows, track_rows = lister.enrich(combined_artists)
    duration = time.perf_counter() - start_time
    print(f"{len(rapper_rows)} artists, {len(track_rows)} tracks in {duration:.2f}s")

    con = connect_motherduck()
    load_to_db(rapper_rows, track_rows, con)
    con.close()
    print("Done!")


if __name__ == "__main__":
    main()
