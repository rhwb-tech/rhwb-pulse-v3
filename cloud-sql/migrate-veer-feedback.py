"""
One-time migration: Export veer_feedback from Supabase → Cloud SQL.

Direct copy — veer_feedback already uses runner_id.

Prerequisites:
  pip install supabase psycopg2-binary

Environment variables:
  SUPABASE_URL          - Supabase project URL
  SUPABASE_SERVICE_KEY  - Supabase service role key (bypasses RLS)
  CLOUD_SQL_HOST        - Cloud SQL host (or Unix socket path)
  CLOUD_SQL_DATABASE    - Database name
  CLOUD_SQL_USER        - Database user
  CLOUD_SQL_PASSWORD    - Database password
"""

import os
import sys
from supabase import create_client
import psycopg2
from psycopg2.extras import execute_values

# --- Configuration ---
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

CLOUD_SQL_HOST = os.environ["CLOUD_SQL_HOST"]
CLOUD_SQL_DATABASE = os.environ["CLOUD_SQL_DATABASE"]
CLOUD_SQL_USER = os.environ["CLOUD_SQL_USER"]
CLOUD_SQL_PASSWORD = os.environ["CLOUD_SQL_PASSWORD"]

BATCH_SIZE = 500


def get_supabase_client():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def get_cloud_sql_conn():
    return psycopg2.connect(
        host=CLOUD_SQL_HOST,
        database=CLOUD_SQL_DATABASE,
        user=CLOUD_SQL_USER,
        password=CLOUD_SQL_PASSWORD,
    )


def fetch_all_paginated(sb, table, select, filters=None):
    """Fetch all rows using pagination (Supabase caps at 1000 per request)."""
    rows = []
    offset = 0
    page_size = 1000
    while True:
        query = sb.table(table).select(select).range(offset, offset + page_size - 1)
        if filters:
            for col, op, val in filters:
                query = query.filter(col, op, val)
        result = query.execute()
        batch = result.data or []
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return rows


def upsert_to_cloud_sql(conn, records):
    """Upsert records into Cloud SQL veer_feedback table."""
    if not records:
        print("  No records to upsert.")
        return 0

    cursor = conn.cursor()
    sql = """
        INSERT INTO veer_feedback (message_id, runner_id, feedback, user_question, assistant_response, comment, created_at)
        VALUES %s
        ON CONFLICT (message_id, runner_id)
        DO UPDATE SET
            feedback           = EXCLUDED.feedback,
            user_question      = EXCLUDED.user_question,
            assistant_response = EXCLUDED.assistant_response,
            comment            = EXCLUDED.comment,
            updated_at         = NOW()
    """
    total = 0
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i : i + BATCH_SIZE]
        values = [
            (
                r["message_id"],
                r["runner_id"],
                r["feedback"],
                r.get("user_question"),
                r.get("assistant_response"),
                r.get("comment"),
                r.get("created_at"),
            )
            for r in batch
        ]
        execute_values(cursor, sql, values)
        total += len(batch)
        print(f"  Upserted {total}/{len(records)} records...")

    conn.commit()
    cursor.close()
    return total


def main():
    print("=== Veer Feedback Migration: Supabase → Cloud SQL ===\n")

    # 1. Connect to Supabase
    print("1. Connecting to Supabase...")
    sb = get_supabase_client()

    # 2. Fetch all veer_feedback rows
    print("2. Fetching veer_feedback rows...")
    rows = fetch_all_paginated(
        sb,
        "veer_feedback",
        "message_id, runner_id, feedback, user_question, assistant_response, comment, created_at",
    )
    print(f"  Fetched {len(rows)} rows from veer_feedback")

    if not rows:
        print("\n  No data to migrate.")
        return

    # 3. Filter out rows missing runner_id
    records = [r for r in rows if r.get("runner_id")]
    skipped = len(rows) - len(records)
    if skipped:
        print(f"  WARNING: Skipped {skipped} rows with missing runner_id")

    # 4. Upsert into Cloud SQL
    print("3. Connecting to Cloud SQL and upserting...")
    conn = get_cloud_sql_conn()
    try:
        total = upsert_to_cloud_sql(conn, records)
        print(f"\n  Successfully upserted {total} records into Cloud SQL.")
    finally:
        conn.close()

    # 5. Verify
    print("\n4. Verification summary:")
    print(f"  Supabase rows fetched:         {len(rows)}")
    print(f"  Records upserted to Cloud SQL: {total}")
    print(f"  Skipped (no runner_id):        {skipped}")

    if total == len(records):
        print("\n  Migration completed successfully.")
    else:
        print("\n  WARNING: Upsert count does not match prepared records.")
        sys.exit(1)


if __name__ == "__main__":
    main()
