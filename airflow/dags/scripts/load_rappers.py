#!/usr/bin/env python
# coding: utf-8
import time
import os
from dotenv import load_dotenv
import pandas as pd
from sqlalchemy import create_engine, text

from scripts.artist_lister import ArtistLister
import scripts.spotify_dicts

path_env = os.path.abspath(__file__ + "/../../")
load_dotenv(os.path.join(path_env, ".env"))

# spotapi reads Spotify's public data anonymously -- no client id/secret needed
sqlalchemy_conn = os.getenv("SUPABASE_URI")#os.getenv("POSTGRES_CONN") #'postgresql://airflow:airflow@127.0.0.1:5555/battle-rap'

genre_dict = scripts.spotify_dicts.genre_dict
playlist_dict = scripts.spotify_dicts.playlist_dict


def compile_artists(lister, genres, playlists):
    print("Compiling artist list...")
    return lister.combine_artists(genres, playlists)


def get_artist_data(lister, combined_artists):
    start_time = time.perf_counter()
    print("Loading artists...")
    df_rappers = pd.DataFrame(lister.pull_artist_data(combined_artists))
    duration = time.perf_counter() - start_time
    print(f"{len(df_rappers)} artists loaded in {duration:.2f} seconds")
    return df_rappers


def get_tracks_data(lister, combined_artists):
    start_time = time.perf_counter()
    print("Loading tracks...")
    df_top_tracks = pd.DataFrame(lister.pull_artist_top_tracks(combined_artists))
    duration = time.perf_counter() - start_time
    print(f"{len(df_top_tracks)} tracks loaded in {duration:.2f} seconds")
    return df_top_tracks


def add_load_date(df_rappers, df_top_tracks):
    # genre flags now come from the seed (see ArtistLister); no per-artist genres
    df_rappers["load_date"] = pd.Timestamp(
        time.strftime("%Y-%m-%d %H:%M:%S %Z", time.gmtime(time.time()))
    )
    df_top_tracks["load_date"] = pd.Timestamp(
        time.strftime("%Y-%m-%d %H:%M:%S %Z", time.gmtime(time.time()))
    )


def create_db_engine(conn_str):
    engine = create_engine(conn_str)
    return engine


def load_to_db(df_rappers, df_top_tracks, engine):
    start_time = time.perf_counter()
    print("Loading raw dataframes to DW...")
    with engine.begin() as connection:
        connection.execute(text("TRUNCATE TABLE rappers"))
        df_rappers.to_sql("rappers", connection, if_exists="append", index=False)
        df_top_tracks.to_sql("top_tracks", connection, if_exists="replace", index=False)
    # connection.commit()
    duration = time.perf_counter() - start_time
    print(f"Loaded in {duration:.2f} seconds")


def main():
    lister = ArtistLister()

    combined_artists = compile_artists(lister, genre_dict, playlist_dict)
    df_rappers = get_artist_data(lister, combined_artists)
    df_top_tracks = get_tracks_data(lister, combined_artists)
    add_load_date(df_rappers, df_top_tracks)

    engine = create_db_engine(sqlalchemy_conn)
    load_to_db(df_rappers, df_top_tracks, engine)
    print("Done!")


if __name__ == "__main__":
    main()
