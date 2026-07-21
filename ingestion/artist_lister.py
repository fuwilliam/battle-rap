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
from ingestion.spotify_dicts import denylist, loose_seeds

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

        # drop hard-excluded artists (fuzzy-search false positives)
        for aid in denylist:
            artists.pop(aid, None)

        return dict(artists)

    def enrich(self, artist_dict, max_workers=12, min_related_in_pool=1):
        """Fetch every artist once (parallel), then genre-filter -> rows.

        One network call per artist yields metadata, top tracks, and related
        artists. Since spotapi exposes no per-artist genre, we use the related
        artists as a genre signal: rappers relate to rappers, so an artist is
        kept only if at least `min_related_in_pool` of their related artists
        also showed up in the discovered pool. This drops keyword-search false
        positives (e.g. a sertanejo singer whose *name* contains "rap") whose
        related artists are all off-genre and thus absent from the pool.
        """

        def work(aid):
            try:
                return aid, self.client.fetch_artist(aid)
            except Exception as e:  # skip artists the scrape can't resolve
                print(f"skip artist {aid} ({artist_dict[aid]['name']}): {e}")
                return aid, None

        enriched = {}
        with ThreadPoolExecutor(max_workers=max_workers) as ex:
            for aid, res in ex.map(work, list(artist_dict)):
                if res:
                    enriched[aid] = res

        pool = set(enriched)
        rapper_rows, track_rows, dropped = [], [], []
        for aid, res in enriched.items():
            overlap = sum(1 for rid in res["related"] if rid in pool)
            if overlap < min_related_in_pool:
                dropped.append(res["artist"]["artist_name"])
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

        if dropped:
            print(f"genre filter dropped {len(dropped)} off-genre artists: {sorted(dropped)}")

        return rapper_rows, track_rows
