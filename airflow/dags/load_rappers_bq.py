#!/usr/bin/env python
# coding: utf-8

from artist_lister import ArtistLister

import pandas as pd
import time

from sqlalchemy.engine import create_engine

client_id = "be914a3cdfac496085266e5043790cc3"
client_secret = "a4459a20e0594023a7229fc1a9ea4d8c"

genreDict = {
    # "rap": 150,
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

sqlalchemy_conn = 'postgresql://airflow:airflow@host.docker.internal:5555/battle-rap'
bigquery_uri = 'bigquery://battle-rap-365403/raw' # pandas to_sql to bigquery is incredibly slow.. try exporting as files to GCS then to BQ
bq_creds_path = '/home/fuwilliam/battle-rap/battle-rap-bq-creds.json'

def compile_artists(lister, genreDict, playlistDict):
    print('Compiling artist list...')
    return lister.combine_artists(genreDict, playlistDict)

def get_artist_data(lister, combinedArtists):
    start_time = time.time()
    print('Loading artists...')
    dfRappers = pd.DataFrame(lister.pull_artist_data(combinedArtists))
    dfRappers['genres'] = dfRappers['genres'].astype(str)
    duration = time.time() - start_time
    print(f'{len(dfRappers)} artists loaded in {duration:.2f} seconds')
    return dfRappers

def get_tracks_data(lister, combinedArtists):
    start_time = time.time()
    print('Loading tracks...')
    dfTopTracks = pd.DataFrame(lister.pull_artist_top_tracks(combinedArtists))
    duration = time.time() - start_time
    print(f'{len(dfTopTracks)} tracks loaded in {duration:.2f} seconds')
    return dfTopTracks

def add_load_date(dfRappers, dfTopTracks):
    dfRappers['load_date'] = pd.Timestamp(time.strftime('%Y-%m-%d %H:%M:%S %Z', time.gmtime(time.time())))
    dfTopTracks['load_date'] = pd.Timestamp(time.strftime('%Y-%m-%d %H:%M:%S %Z', time.gmtime(time.time())))

def create_db_engine(bigquery_uri, bq_creds_path):
    engine = create_engine(bigquery_uri, credentials_path=bq_creds_path)
    return engine

def load_to_db(dfRappers, dfTopTracks, engine):
    start_time = time.time()
    print('Loading raw dataframes to DW...')
    dfRappers.to_sql('rappers', engine, if_exists='replace', index=False)
    dfTopTracks.to_sql('top_tracks', engine, if_exists='replace', index=False)
    duration = time.time() - start_time
    print(f'Loaded in {duration:.2f} seconds')

def main():
    lister = ArtistLister(client_id, client_secret)

    combinedArtists = compile_artists(lister, genreDict, playlistDict)
    dfRappers = get_artist_data(lister, combinedArtists)
    dfTopTracks = get_tracks_data(lister, combinedArtists)
    add_load_date(dfRappers, dfTopTracks)

    engine = create_db_engine(bigquery_uri, bq_creds_path)
    load_to_db(dfRappers, dfTopTracks, engine)
    print('Done!')

if __name__ == "__main__":
    main()