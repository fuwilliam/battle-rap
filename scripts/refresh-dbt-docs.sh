#!/usr/bin/env bash
# Regenerate the dbt docs site served at battlerap.app/dbt-docs.html
# (linked from the navbar, opens in a new tab).
#
# Run after changing models or their descriptions in dbt/, then commit the
# resulting frontend/public/dbt-docs.html. Not in CI on purpose: the repo
# requires PRs for main, so a bot push would be rejected, and wiring up a
# PR-opening job isn't worth it for something that changes a few times a month.
#
# --static emits static_index.html, which inlines manifest.json and
# catalog.json into a single file -- that's what makes it servable straight out
# of Next's public/ dir with no routing or asset-path fixups.
#
# Building the catalog needs the warehouse, so motherduck_token must be set
# (see ~/.zshenv). Swap in --empty-catalog to skip that, at the cost of column
# types and descriptions sourced from the warehouse.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dest="$repo_root/frontend/public/dbt-docs.html"

cd "$repo_root/dbt"
uv run dbt docs generate --profiles-dir . --static

cp target/static_index.html "$dest"
printf 'wrote %s (%s)\n' "$dest" "$(du -h "$dest" | cut -f1)"

if git -C "$repo_root" diff --quiet -- "$dest"; then
    echo 'no change -- docs were already current'
else
    echo 'docs changed -- commit frontend/public/dbt-docs.html to publish'
fi
