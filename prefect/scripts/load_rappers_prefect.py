#!/usr/bin/env python
# coding: utf-8
import time
import os
from dotenv import load_dotenv
import pandas as pd
from sqlalchemy import create_engine
from prefect import flow, task

from scripts.artist_lister import ArtistLister
import scripts.spotify_dicts

path_env = os.path.abspath(__file__ + "/../../")
load_dotenv(os.path.join(path_env, ".env"))

client_id = os.getenv("SPOTIFY_CLIENT_ID")
client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
sqlalchemy_conn = os.getenv("SUPABASE_URI")#os.getenv("POSTGRES_CONN") #'postgresql://airflow:airflow@127.0.0.1:5555/battle-rap'

genre_dict = scripts.spotify_dicts.genre_dict
playlist_dict = scripts.spotify_dicts.playlist_dict

@task
def compile_artists(lister, genres, playlists):
    print("Compiling artist list...")
    return lister.combine_artists(genres, playlists)

@task
def get_artist_data(lister, combined_artists):
    start_time = time.perf_counter()
    print("Loading artists...")
    df_rappers = pd.DataFrame(lister.pull_artist_data(combined_artists))
    duration = time.perf_counter() - start_time
    print(f"{len(df_rappers)} artists loaded in {duration:.2f} seconds")
    return df_rappers

@task
def get_tracks_data(lister, combined_artists):
    start_time = time.perf_counter()
    print("Loading tracks...")
    df_top_tracks = pd.DataFrame(lister.pull_artist_top_tracks(combined_artists))
    duration = time.perf_counter() - start_time
    print(f"{len(df_top_tracks)} tracks loaded in {duration:.2f} seconds")
    return df_top_tracks

@task
def add_load_date(df_rappers, df_top_tracks):
    df_rappers["flag_main_genre"] = df_rappers.genres.astype(str).str.contains("rap|hip hop|drill|grime|pluggnb|escape room")
    df_rappers["flag_excl_genre"] = (df_rappers.genres.astype(str).str.contains("rap rock|rap metal|reggaeton|hyperpop|electropop")) & (~df_rappers.genres.astype(str).str.contains("hip hop"))
    df_rappers["flag_latin_genre"] = df_rappers.genres.astype(str).str.contains("latin|argentin|mexican hip hop")
    df_rappers["load_date"] = pd.Timestamp(
        time.strftime("%Y-%m-%d %H:%M:%S %Z", time.gmtime(time.time()))
    )
    df_top_tracks["load_date"] = pd.Timestamp(
        time.strftime("%Y-%m-%d %H:%M:%S %Z", time.gmtime(time.time()))
    )

@task
def create_db_engine(conn_str):
    engine = create_engine(conn_str)
    return engine

@task
def load_to_db(df_rappers, df_top_tracks, engine):
    start_time = time.perf_counter()
    print("Loading raw dataframes to DW...")
    engine.execute("TRUNCATE TABLE rappers")
    df_rappers.to_sql("rappers", engine, if_exists="append", index=False)
    df_top_tracks.to_sql("top_tracks", engine, if_exists="replace", index=False)
    duration = time.perf_counter() - start_time
    print(f"Loaded in {duration:.2f} seconds")

@flow
def main():
    lister = ArtistLister(client_id, client_secret)

    combined_artists = compile_artists(lister, genre_dict, playlist_dict)
    df_rappers = get_artist_data(lister, combined_artists)
    df_top_tracks = get_tracks_data(lister, combined_artists)
    add_load_date(df_rappers, df_top_tracks)

    engine = create_db_engine(sqlalchemy_conn)
    load_to_db(df_rappers, df_top_tracks, engine)
    print("Done!")


if __name__ == "__main__":
    main()
