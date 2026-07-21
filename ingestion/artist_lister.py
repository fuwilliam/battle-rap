#!/usr/bin/env python
# coding: utf-8
"""Build the rapper list from seed genres + reference playlists, then enrich.

Discovery seeds double as the genre signal (spotapi exposes no per-artist
genres): every artist carries the set of seeds that surfaced them, e.g.
{"rap", "Rap Caviar"}. Enrichment fetches each artist once, in parallel.
"""

from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

from ingestion.spotify_client import SpotifyClient
from ingestion.spotify_dicts import loose_seeds

# all configured seeds are curated hip-hop, so an artist is "core" as long as
# at least one of their seeds isn't a noise-prone loose seed (case-insensitive)
_LOOSE = {s.lower() for s in loose_seeds}


def _is_core(seeds):
    return any(s.lower() not in _LOOSE for s in seeds)


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

    def enrich(self, artist_dict, max_workers=12):
        """Fetch every artist once (parallel) -> (rapper_rows, track_rows).

        Single pass: one network call per artist yields both the artist row
        and its top-track rows.
        """
        rapper_rows, track_rows = [], []

        def work(aid):
            try:
                return aid, self.client.fetch_artist(aid)
            except Exception as e:  # skip artists the scrape can't resolve
                print(f"skip artist {aid} ({artist_dict[aid]['name']}): {e}")
                return aid, None

        with ThreadPoolExecutor(max_workers=max_workers) as ex:
            for aid, res in ex.map(work, list(artist_dict)):
                if not res:
                    continue
                seeds = artist_dict[aid]["seeds"]
                rapper_rows.append(
                    {
                        **res["artist"],
                        "seeds": ",".join(sorted(seeds)),
                        "flag_core_genre": _is_core(seeds),
                    }
                )
                for t in res["top_tracks"]:
                    track_rows.append({"artist_id": aid, **t})

        return rapper_rows, track_rows
