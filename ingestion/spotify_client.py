#!/usr/bin/env python
# coding: utf-8
"""Spotify data access via spotapi (Spotify's internal web endpoints).

Replaces the old client_credentials REST client, which Spotify now gates
behind an active Premium subscription on the app owner. spotapi reads the
same public data anonymously -- no API key, no Premium.

Trade-offs vs the old REST API:
  * `popularity` (0-100) is not exposed -> use `monthly_listeners` instead.
  * per-artist `genres` are not exposed -> genre is inferred from the seed
    (which playlist / search surfaced the artist).
  * `related-artists` (deprecated in the REST API) is available again here.

Caveat: spotapi is unofficial. If Spotify rotates its internal TOTP secret
this breaks until spotapi ships an update (`pip install -U spotapi`).
"""

import threading
import time

from spotapi import Artist, Public, PublicPlaylist
from spotapi.client import BaseClient
from spotapi.exceptions import BaseClientError, RequestError

TRACK_EMBED = "https://open.spotify.com/embed/track/{}?utm_source=generator"

# spotapi's Artist wraps a TLS session that isn't safe to share across threads;
# hand each worker thread its own instance.
_thread = threading.local()


def _artist():
    client = getattr(_thread, "artist", None)
    if client is None:
        client = _thread.artist = Artist()
    return client


# ---- GraphQL hash bootstrap ---------------------------------------------
#
# Every spotapi call needs the persisted-query sha256 hashes, which spotapi
# scrapes out of the web player's JS: one 4.5MB pack + ~72 CDN chunks, all
# fetched serially. It caches the result on the BaseClient *instance*, and
# each Public.* call and each worker thread builds a fresh instance -- so a
# run repeats that ~73-request crawl ~24 times. Any single non-200 anywhere
# in it aborts the whole job with `BaseClientError("Could not get general
# hashes")`, and spotapi never retries (that's the 2026-07-28 CI failure).
#
# So bootstrap once, with retries, and publish the result as a BaseClient
# class attribute: later instances see `raw_hashes` already set and skip the
# crawl entirely (they still open their own session for tokens, which is a
# couple of cheap requests).

_HASH_ATTEMPTS = 4
_HASH_BACKOFF = 5  # seconds, doubled per retry
_hash_lock = threading.Lock()


def prime_hashes(attempts=_HASH_ATTEMPTS):
    """Fetch the GraphQL hashes once and share them across all spotapi clients."""
    with _hash_lock:
        if BaseClient.raw_hashes:  # _Undefined is falsy
            return

        for attempt in range(1, attempts + 1):
            # a fresh Artist each try -- a new TLS session and cookies, in case
            # the previous one is what Spotify objected to
            base = Artist().base
            try:
                base.get_session()
                base.get_sha256_hash()
            except (BaseClientError, RequestError) as exc:
                # spotapi stores the underlying HTTP error on `.error` and
                # leaves it out of str(exc), which is why CI logs show a bare
                # "Could not get general hashes" with no status code
                detail = getattr(exc, "error", None)
                print(f"Hash bootstrap attempt {attempt}/{attempts} failed: {exc} ({detail})")
                if attempt == attempts:
                    raise
                time.sleep(_HASH_BACKOFF * 2 ** (attempt - 1))
                continue

            BaseClient.raw_hashes = base.raw_hashes
            return


def _uri_id(uri):
    """spotify:artist:XXXX -> XXXX (ids come back as either uri or bare id)."""
    return uri.rsplit(":", 1)[-1] if uri else uri


class SpotifyClient:
    def __init__(self):
        prime_hashes()

    # ---- discovery -----------------------------------------------------

    def artists_from_playlist(self, playlist_id):
        """{artist_id: artist_name} for every artist on a public playlist."""
        pl = PublicPlaylist(playlist_id)
        out = {}
        for page in pl.paginate_playlist():
            for item in page["items"]:
                data = item.get("itemV2", {}).get("data")
                if not data or data.get("__typename") != "Track":
                    continue
                for a in data["artists"]["items"]:
                    out[_uri_id(a["uri"])] = a["profile"]["name"]
        return out

    def artists_from_search(self, query, limit=50):
        """{artist_id: artist_name} from an artist search (fuzzy, not genre-exact)."""
        out = {}
        for page in Public.artist_search(query):
            for wrapper in page:
                data = wrapper.get("data", {})
                if data.get("__typename") != "Artist":
                    continue
                out[_uri_id(data["uri"])] = data["profile"]["name"]
                if len(out) >= limit:
                    return out
        return out

    # ---- enrichment ----------------------------------------------------

    def _artist_union(self, artist_id):
        """Raw artistUnion payload -- one network call, holds everything."""
        return _artist().get_artist(artist_id)["data"]["artistUnion"]

    def fetch_artist(self, artist_id):
        """Metadata + top tracks from a SINGLE fetch (stats and topTracks live
        in the same payload -- don't call it twice)."""
        u = self._artist_union(artist_id)
        stats = u.get("stats", {})
        sources = (u.get("visuals", {}).get("avatarImage") or {}).get("sources", [])

        artist = {
            "artist_id": artist_id,
            "artist_name": u["profile"]["name"],
            "monthly_listeners": stats.get("monthlyListeners"),
            "followers": stats.get("followers"),
            "world_rank": stats.get("worldRank"),
            "image_url": sources[0]["url"] if sources else None,
        }

        top_tracks = []
        for rank, it in enumerate(u["discography"]["topTracks"]["items"], start=1):
            t = it["track"]
            tid = _uri_id(t["uri"])
            top_tracks.append(
                {
                    "track_rank": rank,
                    "track_name": t["name"],
                    "track_id": tid,
                    "track_url": TRACK_EMBED.format(tid),
                    "playcount": t.get("playcount"),
                }
            )

        # related artists are a genre signal (rappers relate to rappers); used
        # by the lister to filter out off-genre keyword-search false positives
        related = [
            _uri_id(a.get("uri") or a.get("id"))
            for a in u["relatedContent"]["relatedArtists"]["items"]
        ]

        return {"artist": artist, "top_tracks": top_tracks, "related": related}
