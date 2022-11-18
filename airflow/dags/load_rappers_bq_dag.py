from airflow import DAG
from airflow.decorators import task
from airflow.operators.python import PythonOperator
from airflow.providers.google.cloud.transfers.postgres_to_gcs import PostgresToGCSOperator
from airflow.providers.google.cloud.transfers.gcs_to_bigquery import GCSToBigQueryOperator
from airflow.providers.dbt.cloud.operators.dbt import DbtCloudRunJobOperator
from airflow.models import Variable
from datetime import datetime

from scripts.load_rappers import main

POSTGRES_CONN_ID = Variable.get('POSTGRES_CONN_ID')
SUPABASE_CONN_ID = Variable.get('SUPABASE_CONN_ID')
FILE_FORMAT = Variable.get('FILE_FORMAT')
GCS_BUCKET = Variable.get('GCS_BUCKET')
GCP_CONN_ID = Variable.get('GCP_CONN_ID')

BQ_DS = Variable.get('BQ_DS')
BQ_PROJECT = Variable.get('BQ_PROJECT')

DBT_CONN_ID = Variable.get('DBT_CONN_ID')
DBT_ACCOUNT_ID = Variable.get('DBT_ACCOUNT_ID')
DBT_JOB_ID = Variable.get('DBT_JOB_ID')

tables_to_load = ['rappers', 'top_tracks', 'results']

default_args = {
    'retries': 1
}

with DAG(
    dag_id='load_rappers_bq_dag',
    schedule_interval='0 23 * * *',
    start_date=datetime(2022, 10, 23),
    description="calls load_rappers script, loads data to GCS, then to BigQuery, then triggers dbt Cloud job",
    catchup=False,
    max_active_runs=1,
    default_args=default_args
) as dag:

    load_rappers_task = PythonOperator(
        task_id='load_rappers',
        python_callable=main
    )

    for table_name in tables_to_load:
        load_to_gcs_task = PostgresToGCSOperator(
            task_id=f'load_{table_name}_to_gcs',
            gcp_conn_id=GCP_CONN_ID,
            postgres_conn_id=SUPABASE_CONN_ID,
            sql=f'SELECT * FROM {table_name};',
            bucket=GCS_BUCKET,
            filename=f'{table_name}/{table_name}.{FILE_FORMAT}',
            export_format=f'{FILE_FORMAT}',
            gzip=False,
            use_server_side_cursor=False
        )

        load_to_bq_task = GCSToBigQueryOperator(
            task_id=f'load_{table_name}_to_bq',
            gcp_conn_id=GCP_CONN_ID,
            bucket=GCS_BUCKET,
            source_objects=[f'{table_name}/{table_name}.csv'],
            destination_project_dataset_table='.'.join(
                [BQ_PROJECT, BQ_DS, f'{table_name}']
            ),
            create_disposition='CREATE_IF_NEEDED',
            write_disposition='WRITE_TRUNCATE',
            autodetect=True,
            skip_leading_rows=1
        )

    # trigger_dbt_cloud_job = DbtCloudRunJobOperator(
    #     task_id="trigger_dbt_cloud_job",
    #     dbt_cloud_conn_id=DBT_CONN_ID,
    #     account_id=DBT_ACCOUNT_ID,
    #     job_id=DBT_JOB_ID,
    #     check_interval=10,
    #     timeout=120
    # )

load_rappers_task >> load_to_gcs_task >> load_to_bq_task #>> load_to_bq.expand(table_name=tables_to_load)

#[load_rappers_gcs_task, load_tracks_gcs_task] >> load_results_gcs_task
#load_results_gcs_task >> [load_rappers_bq_task, load_tracks_bq_task] >> load_results_bq_task #>> trigger_dbt_cloud_job
#chain(load_rappers_task, [load_rappers_gcs_task, load_tracks_gcs_task], [load_rappers_bq_task, load_tracks_bq_task], trigger_dbt_cloud_job)