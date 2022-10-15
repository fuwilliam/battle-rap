from airflow import DAG
from airflow.operators.empty import EmptyOperator
from airflow.operators.bash import BashOperator

from datetime import datetime

with DAG(
    dag_id='load_rappers_dag',
    schedule_interval='0 */1 * * *',
    start_date=datetime(2022, 10, 6),
    catchup=False,
    max_active_runs=3,
) as dag:

    start_task = EmptyOperator(
        task_id='start'
    )

    load_rappers_task = BashOperator(
        task_id='load_rappers',
        bash_command='python ${AIRFLOW_HOME}/scripts/load_rappers.py'
    )

    end_task = EmptyOperator(
        task_id='end'
    )

start_task >> load_rappers_task
load_rappers_task >> end_task