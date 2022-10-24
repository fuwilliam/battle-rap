import os
from dotenv import load_dotenv

from airflow import DAG
from airflow.operators.empty import EmptyOperator
from airflow.operators.python import PythonOperator
from airflow.providers.google.cloud.transfers.postgres_to_gcs import PostgresToGCSOperator
from airflow.providers.google.cloud.transfers.gcs_to_bigquery import GCSToBigQueryOperator
from airflow.providers.dbt.cloud.operators.dbt import DbtCloudRunJobOperator
from airflow.utils.dates import days_ago

from scripts.load_rappers import main

load_dotenv()

POSTGRES_CONNECTION_ID = os.getenv('POSTGRES_CONNECTION_ID')
FILE_FORMAT = os.getenv('FILE_FORMAT')
GCS_BUCKET = os.getenv('GCS_BUCKET')
GCP_CONN_ID = os.getenv('GCP_CONN_ID')

BQ_DS = os.getenv('BQ_DS')
BQ_PROJECT = os.getenv('BQ_PROJECT')

DBT_CONN_ID = os.getenv('DBT_CONN_ID')
DBT_ACCOUNT_ID = os.getenv('DBT_ACCOUNT_ID')
DBT_JOB_ID = os.getenv('DBT_JOB_ID')

with DAG(
    dag_id='load_rappers_dag',
    schedule_interval='0 23 * * *',
    start_date=days_ago(1),
    catchup=False,
    max_active_runs=1
) as dag:

    empty = EmptyOperator(
        task_id='empty'
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

    load_rappers_bq_task = GCSToBigQueryOperator(
        task_id=f'load_rappers_to_bq',
        gcp_conn_id=GCP_CONN_ID,
        bucket=GCS_BUCKET,
        source_objects=[f'rappers/rappers.csv'],
        destination_project_dataset_table='.'.join(
            [BQ_PROJECT, BQ_DS, 'rappers']
        ),
        create_disposition='CREATE_IF_NEEDED',
        write_disposition='WRITE_TRUNCATE',
        autodetect=True,
        skip_leading_rows=1
    )

    load_tracks_bq_task = GCSToBigQueryOperator(
        task_id=f'load_tracks_to_bq',
        gcp_conn_id=GCP_CONN_ID,
        bucket=GCS_BUCKET,
        source_objects=[f'top_tracks/top_tracks.csv'],
        destination_project_dataset_table='.'.join(
            [BQ_PROJECT, BQ_DS, 'top_tracks']
        ),
        create_disposition='CREATE_IF_NEEDED',
        write_disposition='WRITE_TRUNCATE',
        autodetect=True,
        skip_leading_rows=1
    )

    trigger_dbt_cloud_job = DbtCloudRunJobOperator(
        task_id="trigger_dbt_cloud_job",
        dbt_cloud_conn_id=DBT_CONN_ID,
        account_id=DBT_ACCOUNT_ID,
        job_id=DBT_JOB_ID,
        check_interval=10,
        timeout=300
    )

load_rappers_task >> [load_rappers_gcs_task, load_tracks_gcs_task] >> empty >> [load_rappers_bq_task, load_tracks_bq_task] >> trigger_dbt_cloud_job