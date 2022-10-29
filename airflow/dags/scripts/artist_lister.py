#!/usr/bin/env python
# coding: utf-8

from collections import defaultdict
from scripts.spotify_client import SpotifyAPI


class ArtistLister(SpotifyAPI):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def parse_search(self, genre, rows=50):
        artist_dict = {}
        for batch in range(0, rows, 50):
            payload = self.search_artist_by_genre(
                genre, limit=min(rows, 50), offset=batch
            )  # batch = [50, 100, 150..]
            for i in range(len(payload["artists"]["items"])):
                artist_dict[payload["artists"]["items"][i]["id"]] = payload["artists"][
                    "items"
                ][i]["name"]
        return artist_dict

    def parse_playlist(self, playlist_id):
        artist_dict = {}
        rows = len(self.get_playlist(playlist_id)["tracks"]["items"])
        for batch in range(0, rows, 50):
            payload = self.get_playlist_artists(
                playlist_id, limit=min(rows, 50), offset=batch
            )
            for i in range(len(payload["items"])):
                if payload["items"][i]["track"] is None:
                    continue
                for j in range(len(payload["items"][i]["track"]["artists"])):
                    artist_dict[
                        payload["items"][i]["track"]["artists"][j]["id"]
                    ] = payload["items"][i]["track"]["artists"][j]["name"]
        return artist_dict

    def union_dict(self, dict1, dict2):
        return dict(list(dict1.items()) + list(dict2.items()))

    def combine_artists(self, genre_dict, playlist_dict):
        artist_dict = {}
        for k, v in genre_dict.items():
            artist_dict = self.union_dict(artist_dict, self.parse_search(k, v))
        for k in playlist_dict.keys():
            artist_dict = self.union_dict(artist_dict, self.parse_playlist(k))
        return artist_dict

    def pull_artist_data(self, artist_dict):
        enriched_dict = defaultdict(list)
        enriched_dict["artist_id"] = list(artist_dict.keys())
        enriched_dict["artist_name"] = list(artist_dict.values())

        for i in enriched_dict["artist_id"]:
            payload = self.get_artist(i)
            enriched_dict["popularity"].append(payload["popularity"])
            enriched_dict["followers"].append(payload["followers"]["total"])
            enriched_dict["genres"].append(payload["genres"][0:3])
            enriched_dict["image_url"].append(
                payload["images"][0]["url"] if len(payload["images"]) > 1 else None
            )
        return enriched_dict

    def pull_artist_top_tracks(self, artist_dict):
        tracks_dict = defaultdict(list)

        for i in list(artist_dict.keys()):
            payload = self.get_top_tracks(i)["tracks"]
            for j in range(min(10, len(payload))):
                tracks_dict["artist_id"].append(i)
                tracks_dict["track_rank"].append(j + 1)
                tracks_dict["track_name"].append(payload[j]["name"])
                tracks_dict["track_id"].append(payload[j]["id"])
                tracks_dict["track_url"].append(payload[j]["external_urls"]["spotify"])
                tracks_dict["preview_url"].append(payload[j]["preview_url"])
        return tracks_dict
