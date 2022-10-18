FROM apache/airflow:latest-python3.8

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    build-essential \
    && apt-get autoremove -yqq --purge \
    && apt-get -y install libpq-dev gcc \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

USER airflow

COPY /Pipfile /Pipfile
COPY /Pipfile.lock /Pipfile.lock

RUN pip install --upgrade pip
RUN pip install pipenv
RUN pipenv requirements > requirements.txt
RUN pip install --no-cache-dir --user -r requirements.txt