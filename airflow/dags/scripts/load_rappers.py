#!/usr/bin/env python
# coding: utf-8
import os
from dotenv import load_dotenv
from scripts.artist_lister import ArtistLister

import pandas as pd
import time

from sqlalchemy import create_engine

path_env = os.path.abspath(__file__ + "/../../")
load_dotenv(os.path.join(path_env, '.env'))

client_id = os.getenv('SPOTIFY_CLIENT_ID')
client_secret = os.getenv('SPOTIFY_CLIENT_SECRET')
sqlalchemy_conn = os.getenv('POSTGRES_CONN')

genreDict = {
    #"rap": 150,
    # "hip hop": 150,
    # "alternative hip hop": 50,
    # "escape room": 50,
    # "drill": 30,
    # "grime": 20,
    "pluggnb": 20
}

playlistDict = {
    # "37i9dQZF1DX0XUsuxWHRQd": "Rap Caviar",
    # "37i9dQZF1DWY4xHQp97fN6": "Get Turnt",
    # "37i9dQZF1DWTggY0yqBxES": "Alternative Hip Hop",
    # "37i9dQZF1DX9oh43oAzkyx": "Beast Mode Hip Hop",
    # "37i9dQZF1DX186v583rmzp": "90s Hip Hop"
}

def compile_artists(lister, genreDict, playlistDict):
    print('Compiling artist list...')
    return lister.combine_artists(genreDict, playlistDict)

def get_artist_data(lister, combinedArtists):
    start_time = time.perf_counter()
    print('Loading artists...')
    dfRappers = pd.DataFrame(lister.pull_artist_data(combinedArtists))
    duration = time.perf_counter() - start_time
    print(f'{len(dfRappers)} artists loaded in {duration:.2f} seconds')
    return dfRappers

def get_tracks_data(lister, combinedArtists):
    start_time = time.perf_counter()
    print('Loading tracks...')
    dfTopTracks = pd.DataFrame(lister.pull_artist_top_tracks(combinedArtists))
    duration = time.perf_counter() - start_time
    print(f'{len(dfTopTracks)} tracks loaded in {duration:.2f} seconds')
    return dfTopTracks

def add_load_date(dfRappers, dfTopTracks):
    dfRappers['load_date'] = pd.Timestamp(time.strftime('%Y-%m-%d %H:%M:%S %Z', time.gmtime(time.time())))
    dfTopTracks['load_date'] = pd.Timestamp(time.strftime('%Y-%m-%d %H:%M:%S %Z', time.gmtime(time.time())))

def create_db_engine(sqlalchemy_conn):
    engine = create_engine(sqlalchemy_conn)
    return engine

def load_to_db(dfRappers, dfTopTracks, engine):
    start_time = time.perf_counter()
    print('Loading raw dataframes to DW...')
    dfRappers.to_sql('rappers', engine, if_exists='replace', index=False)
    dfTopTracks.to_sql('top_tracks', engine, if_exists='replace', index=False)
    duration = time.perf_counter() - start_time
    print(f'Loaded in {duration:.2f} seconds')

def main():
    lister = ArtistLister(client_id, client_secret)

    combinedArtists = compile_artists(lister, genreDict, playlistDict)
    dfRappers = get_artist_data(lister, combinedArtists)
    dfTopTracks = get_tracks_data(lister, combinedArtists)
    add_load_date(dfRappers, dfTopTracks)

    engine = create_db_engine(sqlalchemy_conn)
    load_to_db(dfRappers, dfTopTracks, engine)
    print('Done!')

if __name__ == "__main__":
    main()