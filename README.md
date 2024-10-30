# [battlerap.app](https://battlerap.app)

A project built to answer the quintessential question: who is the greatest rapper?

![Demo](https://github.com/fuwilliam/battle-rap/blob/main/images/demo.png)

## Architecture

![Architecture](https://github.com/fuwilliam/battle-rap/blob/main/images/architecture_zoom.png)

Summary:

1. Compile artist & track data from [Spotify's Web API](https://developer.spotify.com/documentation/web-api/) based on genre/playlist criteria with `Python` + `Pandas`
2. Load data to a [Supabase](https://supabase.com/) Postgres database with `SQLAlchemy`
3. Artist & track data is served to the [web app](https://battlerap.app/) (with `Flask` / `SQLAlchemy`), where the user makes their picks
4. Matchup results are written back to Supabase
5. Raw artist, track and matchup data is loaded to [GCS](https://cloud.google.com/storage)
6. Data is loaded from GCS to [BigQuery](https://cloud.google.com/bigquery)
7. Staging and mart models are built, tested and documented with [dbt](https://www.getdbt.com)
8. Models are loaded from BigQuery to a [Power BI](https://powerbi.microsoft.com/) dashboard

[Airflow](https://airflow.apache.org/) (ran locally with [Docker](https://www.docker.com/)) orchestrates steps 1-2 and 5-7.

## Dashboard
View live @ [battlerap.app/visualize](https://battlerap.app/visualize)


## Ideas for the future

- Play song snippet when hovering on artist picture
- Create a bracket mode (March Madness style) to force user into "tougher" choices and ultimately crown a champion
- Elo rating or MaxDiff to rank artists
- Popularity filter to narrow down matchup possibilities for user

