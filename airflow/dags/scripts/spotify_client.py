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

from spotapi import Artist, Public, PublicPlaylist

TRACK_EMBED = "https://open.spotify.com/embed/track/{}?utm_source=generator"


def _uri_id(uri):
    """spotify:artist:XXXX -> XXXX (ids come back as either uri or bare id)."""
    return uri.rsplit(":", 1)[-1] if uri else uri


class SpotifyClient:
    def __init__(self):
        # reuse one TLS client across calls
        self._artist = Artist()

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

    def related_artists(self, artist_id):
        """{artist_id: artist_name} -- revived; the REST endpoint is dead."""
        u = self._artist.get_artist(artist_id)["data"]["artistUnion"]
        return {
            _uri_id(a.get("uri") or a.get("id")): a["profile"]["name"]
            for a in u["relatedContent"]["relatedArtists"]["items"]
        }

    # ---- enrichment ----------------------------------------------------

    def get_artist(self, artist_id):
        """Flat artist metadata. `monthly_listeners` replaces old `popularity`."""
        u = self._artist.get_artist(artist_id)["data"]["artistUnion"]
        stats = u.get("stats", {})
        sources = (u.get("visuals", {}).get("avatarImage") or {}).get("sources", [])
        return {
            "artist_id": artist_id,
            "artist_name": u["profile"]["name"],
            "monthly_listeners": stats.get("monthlyListeners"),
            "followers": stats.get("followers"),
            "world_rank": stats.get("worldRank"),
            "image_url": sources[0]["url"] if sources else None,
        }

    def get_top_tracks(self, artist_id):
        """List of the artist's top tracks with rank + playcount."""
        u = self._artist.get_artist(artist_id)["data"]["artistUnion"]
        items = u["discography"]["topTracks"]["items"]
        out = []
        for rank, it in enumerate(items, start=1):
            t = it["track"]
            tid = _uri_id(t["uri"])
            out.append(
                {
                    "track_rank": rank,
                    "track_name": t["name"],
                    "track_id": tid,
                    "track_url": TRACK_EMBED.format(tid),
                    "playcount": t.get("playcount"),
                }
            )
        return out
