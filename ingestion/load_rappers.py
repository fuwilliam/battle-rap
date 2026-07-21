#!/usr/bin/env python
# coding: utf-8
"""Ingest Spotify artists + top tracks into MotherDuck (raw schema).

Run from the repo root:  python -m ingestion.load_rappers
"""

import os
import time

import duckdb
import pandas as pd
from dotenv import load_dotenv

import ingestion.spotify_dicts
from ingestion.artist_lister import ArtistLister

load_dotenv()

# Target is MotherDuck (cloud DuckDB); auth via the `motherduck_token` env var.
MOTHERDUCK_DATABASE = os.getenv("MOTHERDUCK_DATABASE", "battlerap")

genre_dict = ingestion.spotify_dicts.genre_dict
playlist_dict = ingestion.spotify_dicts.playlist_dict


def compile_artists(lister, genres, playlists):
    print("Compiling artist list...")
    return lister.combine_artists(genres, playlists)


def add_load_date(df_rappers, df_top_tracks):
    # genre flags come from the seed (see ArtistLister); no per-artist genres
    now = pd.Timestamp(time.strftime("%Y-%m-%d %H:%M:%S %Z", time.gmtime(time.time())))
    df_rappers["load_date"] = now
    df_top_tracks["load_date"] = now


def connect_motherduck():
    """Open the DuckDB target.

    Uses a local .duckdb file if DUCKDB_LOCAL_PATH is set (handy for testing),
    otherwise MotherDuck (`md:` path; token from the `motherduck_token` env).
    """
    local = os.getenv("DUCKDB_LOCAL_PATH")
    if local:
        return duckdb.connect(local)
    return duckdb.connect(f"md:{MOTHERDUCK_DATABASE}")


def load_to_db(df_rappers, df_top_tracks, con):
    start_time = time.perf_counter()
    print("Loading raw dataframes to MotherDuck...")

    con.execute("CREATE SCHEMA IF NOT EXISTS raw")

    # register() exposes a pandas df to SQL with zero copy; CREATE OR REPLACE
    # gives a clean full-refresh of the raw tables each run.
    con.register("df_rappers", df_rappers)
    con.register("df_top_tracks", df_top_tracks)
    con.execute("CREATE OR REPLACE TABLE raw.rappers AS SELECT * FROM df_rappers")
    con.execute("CREATE OR REPLACE TABLE raw.top_tracks AS SELECT * FROM df_top_tracks")

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

    duration = time.perf_counter() - start_time
    print(f"Loaded in {duration:.2f} seconds")


def main():
    lister = ArtistLister()

    combined_artists = compile_artists(lister, genre_dict, playlist_dict)

    print(f"Enriching {len(combined_artists)} artists (parallel)...")
    start_time = time.perf_counter()
    rapper_rows, track_rows = lister.enrich(combined_artists)
    df_rappers = pd.DataFrame(rapper_rows)
    df_top_tracks = pd.DataFrame(track_rows)
    duration = time.perf_counter() - start_time
    print(f"{len(df_rappers)} artists, {len(df_top_tracks)} tracks in {duration:.2f}s")

    add_load_date(df_rappers, df_top_tracks)

    con = connect_motherduck()
    load_to_db(df_rappers, df_top_tracks, con)
    con.close()
    print("Done!")


if __name__ == "__main__":
    main()
