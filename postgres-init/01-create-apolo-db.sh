#!/bin/sh
set -eu

if [ -z "${APOLO_DB_NAME:-}" ] || [ -z "${APOLO_DB_USER:-}" ] || [ -z "${APOLO_DB_PASS:-}" ]; then
  echo "APOLO_DB_NAME, APOLO_DB_USER o APOLO_DB_PASS no definidos; omitiendo bootstrap de Apolo."
  exit 0
fi

psql \
  -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=apolo_db_name="$APOLO_DB_NAME" \
  --set=apolo_db_user="$APOLO_DB_USER" \
  --set=apolo_db_pass="$APOLO_DB_PASS" <<-'EOSQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'apolo_db_user', :'apolo_db_pass')
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_catalog.pg_roles
  WHERE rolname = :'apolo_db_user'
)\gexec

SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'apolo_db_user', :'apolo_db_pass')
WHERE EXISTS (
  SELECT 1
  FROM pg_catalog.pg_roles
  WHERE rolname = :'apolo_db_user'
)\gexec

SELECT format('CREATE DATABASE %I OWNER %I', :'apolo_db_name', :'apolo_db_user')
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_database
  WHERE datname = :'apolo_db_name'
)\gexec
EOSQL
