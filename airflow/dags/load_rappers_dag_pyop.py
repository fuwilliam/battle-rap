from airflow import DAG
from airflow.operators.empty import EmptyOperator
from airflow.operators.python import PythonOperator
from airflow.providers.google.cloud.transfers.postgres_to_gcs import PostgresToGCSOperator
from airflow.utils.dates import days_ago
import sys
import os
sys.path.insert(0,os.path.abspath(os.path.dirname(__file__)))# sys.path.append('/home/fuwilliam/airflow/dags/scripts/')
from scripts.load_rappers import main

GCS_BUCKET = 'raw_battle_rap'
POSTGRES_CONNECTION_ID = 'postgres-dc'
GCP_CONN_ID = 'gcp_test'
FILE_FORMAT = 'csv'

with DAG(
    dag_id='load_rappers_dag_pyop',
    schedule_interval='0 23 * * *',
    start_date=days_ago(1),
    catchup=False,
    max_active_runs=3
) as dag:

    start_task = EmptyOperator(
        task_id='start'
    )

    load_rappers_task = PythonOperator(
        task_id='load_rappers',
        python_callable=main
    )

    load_rappers_gcs_task = PostgresToGCSOperator(
        task_id=f'load_rappers_to_gcs',
        gcp_conn_id=GCP_CONN_ID,
        postgres_conn_id=POSTGRES_CONNECTION_ID,
        sql=f'SELECT * FROM rappers;',
        bucket=GCS_BUCKET,
        filename=f'rappers/rappers.{FILE_FORMAT}',
        export_format=f'{FILE_FORMAT}',
        gzip=False,
        use_server_side_cursor=False
    )

    load_tracks_gcs_task = PostgresToGCSOperator(
        task_id=f'load_tracks_to_gcs',
        gcp_conn_id=GCP_CONN_ID,
        postgres_conn_id=POSTGRES_CONNECTION_ID,
        sql=f'SELECT * FROM top_tracks;',
        bucket=GCS_BUCKET,
        filename=f'top_tracks/top_tracks.{FILE_FORMAT}',
        export_format=f'{FILE_FORMAT}',
        gzip=False,
        use_server_side_cursor=False
    )

    end_task = EmptyOperator(
        task_id='end'
    )

start_task >> load_rappers_task >> [load_rappers_gcs_task, load_tracks_gcs_task] >> end_task