#!/usr/bin/env python
# coding: utf-8

from spotify_client import SpotifyAPI
from collections import defaultdict

class ArtistLister(SpotifyAPI):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
    def parse_search(self, genre, rows=50):
        artistDict = {}
        for batch in range(0, rows, 50):
            payload = self.search_artist_by_genre(genre, limit=min(rows, 50), offset=batch) # batch = [50, 100, 150..]
            for i in range(len(payload['artists']['items'])):
                artistDict[payload['artists']['items'][i]['id']] = payload['artists']['items'][i]['name']
        return artistDict

    def parse_playlist(self, playlist_id):
        artistDict = {}
        rows = len(self.get_playlist(playlist_id)['tracks']['items'])
        for batch in range(0, rows, 50):
            payload = self.get_playlist_artists(playlist_id, limit=min(rows, 50), offset=batch)
            for i in range(len(payload['items'])):
                if payload['items'][i]['track'] is None:
                    continue
                for j in range(len(payload['items'][i]['track']['artists'])):
                    artistDict[payload['items'][i]['track']['artists'][j]['id']] = payload['items'][i]['track']['artists'][j]['name']
        return artistDict

    def union_dict(self, dict1, dict2):
        return dict(list(dict1.items()) + list(dict2.items()))

    def combine_artists(self, genreDict, playlistDict):
        artistDict = {}
        for k, v in genreDict.items():
            artistDict = self.union_dict(artistDict, self.parse_search(k, v))
        for k in playlistDict.keys():
            artistDict = self.union_dict(artistDict, self.parse_playlist(k))
        return artistDict

    def pull_artist_data(self, artistDict):
        enrichedDict = defaultdict(list)
        enrichedDict['artist_id'] = list(artistDict.keys())
        enrichedDict['artist_name'] = list(artistDict.values())

        for i in enrichedDict['artist_id']:
            payload = self.get_artist(i)
            enrichedDict['popularity'].append(payload['popularity'])
            enrichedDict['followers'].append(payload['followers']['total'])
            enrichedDict['genres'].append(payload['genres'][0:3])
            enrichedDict['image_url'].append(payload['images'][0]['url'] if len(payload['images']) > 1 else None)
        return enrichedDict
  
    def pull_artist_top_tracks(self, artistDict):
        tracksDict = defaultdict(list)

        for i in list(artistDict.keys()):
            payload = self.get_top_tracks(i)['tracks']
            for j in range(min(5, len(payload))):
                tracksDict['artist_id'].append(i)
                tracksDict['track_rank'].append(j+1)
                tracksDict['track_name'].append(payload[j]['name'])
                tracksDict['track_id'].append(payload[j]['id'])
                tracksDict['track_url'].append(payload[j]['external_urls']['spotify'])
                tracksDict['preview_url'].append(payload[j]['preview_url'])
        return tracksDict
