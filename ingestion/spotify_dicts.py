"""Dictionaries to define which genres and playlists will compose the list of artists"""

# Dict of genres and number of artists to be returned.
genre_dict = {
    "rap": 120,
    "hip hop": 120,
    "alternative hip hop": 40,
    "escape room": 40,
    "drill": 30,
    "grime": 20,
    "pluggnb": 20
}

# Dict of Spotify curated playlist IDs -- the name becomes the artist's seed
playlist_dict = {
    "37i9dQZF1DX0XUsuxWHRQd": "Rap Caviar",
    "37i9dQZF1DWY4xHQp97fN6": "Get Turnt",
    "37i9dQZF1DWTggY0yqBxES": "Alternative Hip Hop",
    "37i9dQZF1DX9oh43oAzkyx": "Beast Mode Hip Hop",
    "37i9dQZF1DX186v583rmzp": "90s Hip Hop"
}

# Noise-prone seeds: fuzzy searches on these drag in off-genre artists.
# An artist surfaced ONLY by loose seeds is not flagged core (flag_core_genre).
# Compared case-insensitively against an artist's seeds.
loose_seeds = {"escape room"}

# Spotify artist IDs to hard-exclude (manual override for anything the
# related-artist graph filter misses). Currently EMPTY on purpose: we're
# testing whether the graph filter catches off-genre slips (e.g. Raphaela
# Santos, a sertanejo singer matched by the "rap" keyword) on its own.
# Re-add IDs here if a slip survives the filter.
denylist: set[str] = set()
