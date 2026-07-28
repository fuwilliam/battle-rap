#!/usr/bin/env python
# coding: utf-8
"""Ingest Spotify artists + top tracks into MotherDuck (raw schema).

Run from the repo root:  python -m ingestion.load_rappers
"""

import os
import time
from datetime import datetime

import duckdb
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

    # One timestamp for the entire run, bound as a parameter. It CANNOT be
    # `now()` inside the INSERT: executemany evaluates that per row, which gave
    # all 5000 track rows distinct microsecond stamps -- and staging picks each
    # artist's latest snapshot by load_date, so "latest" collapsed to a single
    # track per artist instead of their top 10.
    run_ts = datetime.now()

    # The raw tables are APPEND-ONLY: one snapshot row per artist per run, every
    # row of that run sharing run_ts. They used to be CREATE OR REPLACE, which
    # meant a single transient
    # Spotify failure during enrichment erased that artist everywhere
    # downstream -- the 2026-07-27 run silently dropped Pusha T and 28 others
    # out of the battle pool. Keeping history lets stg_rappers fall back to an
    # artist's last good observation and age them out on last_seen_at instead
    # (see mart/rappers_filtered.sql). ~600 rows/day is nothing to store.
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
        con.executemany(
            "INSERT INTO raw.rappers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                (
                    r["artist_id"],
                    r["artist_name"],
                    r["monthly_listeners"],
                    r["followers"],
                    r["world_rank"],
                    r["image_url"],
                    r["seeds"],
                    r["flag_core_genre"],
                    run_ts,
                )
                for r in rapper_rows
            ],
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
        con.executemany(
            "INSERT INTO raw.top_tracks VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                (
                    t["artist_id"],
                    t["track_rank"],
                    t["track_name"],
                    t["track_id"],
                    t["track_url"],
                    _int(t["playcount"]),
                    run_ts,
                )
                for t in track_rows
            ],
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
