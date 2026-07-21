# Battle Rap — frontend (Next.js)

Modern rebuild of the Battle Rap web app. Replaces the Flask + Bootstrap + Grid.js app
with **Next.js (App Router) + Tailwind CSS**, reading/writing the same **Supabase Postgres**
database. Designed to deploy free on **Vercel**.

## Stack (and why)

| Piece | Choice | Why |
|-------|--------|-----|
| Framework | Next.js App Router | Most widely used React framework; server components fetch data, built-in route handlers replace the Flask API, deploys free to Vercel with zero config. |
| Styling | Tailwind CSS v4 | Utility CSS, no separate stylesheet to maintain. |
| Data | `@supabase/supabase-js` | Talks to the existing Supabase Postgres over its REST API — serverless-friendly (no connection-pool exhaustion), no DB changes needed. |
| Hosting | Vercel free tier | Push-to-deploy from GitHub, scales to zero, $0 at this traffic. |

The dbt / BigQuery / Power BI analytics pipeline is untouched — this only swaps the app layer.

## Routes

- `/` — vote page. Two random eligible rappers side by side; tap one to vote. Client refetches the next matchup without a full reload.
- `/ranking` — leaderboard table (reads the `rankings` view).
- `/about`, `/visualize` — static content + the Power BI embed.
- `/api/matchup` (GET) — returns a fresh random matchup.
- `/api/vote` (POST `{winner_id, loser_id}`) — inserts a row into `results`.

Eligibility filter matches the old Flask app: `flag_core_genre = true AND monthly_listeners >= 1,000,000 AND followers >= 100,000`.

## Local dev

```bash
cp .env.example .env.local   # then fill in the two Supabase values
npm install
npm run dev                  # http://localhost:3000
```

Get `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the Supabase dashboard →
Project Settings → API. The service-role key is a server secret — it's only used in
server code here and is never sent to the browser.

## Deploy to Vercel

1. Push this repo to GitHub (already the case).
2. On [vercel.com](https://vercel.com) → **Add New Project** → import the repo.
3. Set **Root Directory** to `frontend`.
4. Add the two env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) under Settings → Environment Variables.
5. Deploy. Point the `battlerap.app` domain at the Vercel project when ready.

Once live, App Engine / GKE can be retired.
