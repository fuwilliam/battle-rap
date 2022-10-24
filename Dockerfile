FROM apache/airflow:2.4.1

USER airflow

RUN pip install --no-cache-dir apache-airflow-providers-dbt-cloud
