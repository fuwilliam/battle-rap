import Link from "next/link";

export const metadata = { title: "Battle Rap | About" };

export default function AboutPage() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-4 text-3xl font-bold">Welcome to Battle Rap!</h1>
      <p className="mb-6 text-lg text-white/80">
        <strong>TL;DR:</strong> Choose between two randomly matched hip hop artists to help us
        decide who&apos;s the greatest!
      </p>

      <div className="space-y-4 text-white/70">
        <p>The artists are compiled from two main sources in Spotify&apos;s public data:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            Searching for the top n results for a given{" "}
            <a
              className="text-accent hover:underline"
              href="https://github.com/fuwilliam/battle-rap/blob/main/airflow/dags/scripts/spotify_dicts.py#L4"
            >
              hip hop / rap related genre
            </a>
          </li>
          <li>
            From specific{" "}
            <a
              className="text-accent hover:underline"
              href="https://github.com/fuwilliam/battle-rap/blob/main/airflow/dags/scripts/spotify_dicts.py#L15"
            >
              Spotify curated playlists
            </a>{" "}
            (e.g. Rap Caviar)
          </li>
        </ul>
        <p>
          The initial list is then filtered by monthly listeners and follower count. Because
          Spotify no longer exposes per-artist genres, relevance is inferred from which seed
          (playlist or genre search) surfaced the artist — so you may still see the occasional
          off-genre artist that a fuzzy search dragged in.
        </p>
        <p>
          From the final list, two are randomly matched, and you decide who wins. If you need help
          choosing or just want to discover new music, each artist&apos;s top 3 tracks (Spotify US
          market) are embedded to preview.
        </p>
        <p>
          With all the collective data, the{" "}
          <Link className="text-accent hover:underline" href="/ranking">
            ranking
          </Link>{" "}
          tab lists artists by wins/losses and win rate, while the{" "}
          <Link className="text-accent hover:underline" href="/visualize">
            visualize
          </Link>{" "}
          tab has a fancy dashboard.
        </p>
      </div>
    </section>
  );
}
