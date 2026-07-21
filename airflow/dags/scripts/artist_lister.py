#!/usr/bin/env python
# coding: utf-8
"""Build the rapper list from seed genres + reference playlists, then enrich.

Discovery seeds double as the genre signal (spotapi exposes no per-artist
genres): every artist carries the set of seeds that surfaced them, e.g.
{"rap", "Rap Caviar"}. Downstream filtering uses those seeds.
"""

from collections import defaultdict

from scripts.spotify_client import SpotifyClient

# seeds treated as core hip-hop; artists surfaced only by other seeds are noise
CORE_SEEDS = {"rap", "hip hop", "alternative hip hop", "drill", "grime",
              "pluggnb", "escape room"}


class ArtistLister:
    def __init__(self):
        self.client = SpotifyClient()

    def combine_artists(self, genre_dict, playlist_dict):
        """{artist_id: {"name": str, "seeds": set}} from searches + playlists."""
        artists = defaultdict(lambda: {"name": None, "seeds": set()})

        for genre, limit in genre_dict.items():
            for aid, name in self.client.artists_from_search(genre, limit).items():
                artists[aid]["name"] = name
                artists[aid]["seeds"].add(genre)

        for pid, pname in playlist_dict.items():
            for aid, name in self.client.artists_from_playlist(pid).items():
                artists[aid]["name"] = name
                artists[aid]["seeds"].add(pname)

        return dict(artists)

    def pull_artist_data(self, artist_dict):
        """One enriched row per artist (monthly_listeners replaces popularity)."""
        rows = defaultdict(list)
        for aid, meta in artist_dict.items():
            try:
                a = self.client.get_artist(aid)
            except Exception as e:  # skip artists the scrape can't resolve
                print(f"skip artist {aid} ({meta['name']}): {e}")
                continue
            seeds = sorted(meta["seeds"])
            rows["artist_id"].append(a["artist_id"])
            rows["artist_name"].append(a["artist_name"])
            rows["monthly_listeners"].append(a["monthly_listeners"])
            rows["followers"].append(a["followers"])
            rows["world_rank"].append(a["world_rank"])
            rows["image_url"].append(a["image_url"])
            rows["seeds"].append(",".join(seeds))
            rows["flag_core_genre"].append(bool(meta["seeds"] & CORE_SEEDS))
        return rows

    def pull_artist_top_tracks(self, artist_dict):
        """Flattened top-tracks table across all artists."""
        rows = defaultdict(list)
        for aid in artist_dict:
            try:
                tracks = self.client.get_top_tracks(aid)
            except Exception as e:
                print(f"skip tracks {aid}: {e}")
                continue
            for t in tracks:
                rows["artist_id"].append(aid)
                rows["track_rank"].append(t["track_rank"])
                rows["track_name"].append(t["track_name"])
                rows["track_id"].append(t["track_id"])
                rows["track_url"].append(t["track_url"])
                rows["playcount"].append(t["playcount"])
        return rows
