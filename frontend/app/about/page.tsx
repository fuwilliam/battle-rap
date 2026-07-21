import Link from "next/link";

export const metadata = { title: "Battle Rap | About" };

export default function AboutPage() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-4 text-3xl font-bold">About</h1>
      <p className="mb-6 text-lg text-white/80">
        Two hip-hop artists, picked at random. You decide who wins. Enough votes, and a
        ranking emerges.
      </p>

      <div className="space-y-4 text-white/70">
        <p>
          The roster is pulled from Spotify — artists that surface under a set of{" "}
          <a
            className="text-accent hover:underline"
            href="https://github.com/fuwilliam/battle-rap/blob/main/ingestion/spotify_dicts.py"
          >
            hip-hop genres and playlists
          </a>{" "}
          (RapCaviar, Beast Mode, and friends), then filtered by monthly listeners and
          followers.
        </p>
        <p>
          Spotify no longer exposes per-artist genres, so relevance is inferred from which
          seed surfaced an artist. A fuzzy match sneaks through now and then — consider it a
          wildcard.
        </p>
        <p>
          Each matchup embeds both artists&apos; top tracks, so you can settle it by ear.
          Votes feed the{" "}
          <Link className="text-accent hover:underline" href="/ranking">
            ranking
          </Link>{" "}
          board and the{" "}
          <Link className="text-accent hover:underline" href="/visualize">
            visualize
          </Link>{" "}
          dashboard.
        </p>
        <p className="text-sm text-white/50">
          Spotify data via an unofficial client, warehoused in MotherDuck, transformed with
          dbt, and refreshed daily by GitHub Actions.{" "}
          <a
            className="text-accent hover:underline"
            href="https://github.com/fuwilliam/battle-rap"
          >
            Source on GitHub
          </a>
          .
        </p>
      </div>
    </section>
  );
}
