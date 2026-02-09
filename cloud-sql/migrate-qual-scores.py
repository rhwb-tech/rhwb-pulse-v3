"""
One-time migration: Export qual scores from Supabase → Cloud SQL.

Sources:
  1. rhwb_coach_input (Season >= 14): meso_qual_score
  2. rhwb_meso_scores (Season <= 13, category='Personal'): qual

Maps email_id → runner_id via runners_profile.
Upserts into Cloud SQL qual_scores table.

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


def fetch_runner_id_map(sb):
    """Build email_id → runner_id lookup from runners_profile."""
    rows = fetch_all_paginated(sb, "runners_profile", "email_id, runner_id")
    mapping = {r["email_id"]: r["runner_id"] for r in rows if r.get("runner_id")}
    print(f"  Loaded {len(mapping)} runner_id mappings from runners_profile")
    return mapping


def fetch_coach_input_quals(sb):
    """Fetch Season >= 14 qual scores from rhwb_coach_input."""
    rows = fetch_all_paginated(
        sb,
        "rhwb_coach_input",
        "email_id, season, meso, meso_qual_score",
        filters=[("meso_qual_score", "not.is", "null")],
    )
    # Filter out empty strings
    rows = [r for r in rows if r.get("meso_qual_score") and r["meso_qual_score"].strip()]
    print(f"  Fetched {len(rows)} rows from rhwb_coach_input")
    return rows


def fetch_legacy_quals(sb):
    """Fetch Season <= 13 qual scores from rhwb_meso_scores."""
    rows = fetch_all_paginated(
        sb,
        "rhwb_meso_scores",
        "email_id, season, meso, qual",
        filters=[
            ("category", "eq", "Personal"),
            ("qual", "not.is", "null"),
        ],
    )
    # Keep only legacy seasons (<= 13) and non-empty qual
    legacy = []
    for r in rows:
        season_str = r.get("season", "")
        season_num = "".join(c for c in season_str if c.isdigit())
        if season_num and int(season_num) <= 13 and r.get("qual") and r["qual"].strip():
            legacy.append(r)
    print(f"  Fetched {len(legacy)} legacy rows from rhwb_meso_scores")
    return legacy


def upsert_to_cloud_sql(conn, records):
    """Upsert records into Cloud SQL qual_scores table."""
    if not records:
        print("  No records to upsert.")
        return 0

    cursor = conn.cursor()
    sql = """
        INSERT INTO qual_scores (runner_id, season, meso, qual_score, source_table)
        VALUES %s
        ON CONFLICT (runner_id, season, meso)
        DO UPDATE SET
            qual_score   = EXCLUDED.qual_score,
            source_table = EXCLUDED.source_table,
            updated_at   = NOW()
    """
    total = 0
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i : i + BATCH_SIZE]
        values = [
            (r["runner_id"], r["season"], r["meso"], r["qual_score"], r["source_table"])
            for r in batch
        ]
        execute_values(cursor, sql, values)
        total += len(batch)
        print(f"  Upserted {total}/{len(records)} records...")

    conn.commit()
    cursor.close()
    return total


def main():
    print("=== Qual Score Migration: Supabase → Cloud SQL ===\n")

    # 1. Connect to Supabase
    print("1. Connecting to Supabase...")
    sb = get_supabase_client()

    # 2. Build runner_id map
    print("2. Loading runner_id mappings...")
    runner_map = fetch_runner_id_map(sb)

    # 3. Fetch qual scores from rhwb_coach_input (Season >= 14)
    print("3. Fetching qual scores from rhwb_coach_input...")
    coach_input_rows = fetch_coach_input_quals(sb)

    # 4. Fetch legacy qual scores from rhwb_meso_scores (Season <= 13)
    print("4. Fetching legacy qual scores from rhwb_meso_scores...")
    legacy_rows = fetch_legacy_quals(sb)

    # 5. Map email_id → runner_id and build upsert records
    print("5. Mapping email_id → runner_id...")
    records = []
    unmapped = set()

    for row in coach_input_rows:
        email = row["email_id"]
        runner_id = runner_map.get(email)
        if not runner_id:
            unmapped.add(email)
            continue
        records.append(
            {
                "runner_id": runner_id,
                "season": row["season"],
                "meso": row["meso"],
                "qual_score": row["meso_qual_score"],
                "source_table": "rhwb_coach_input",
            }
        )

    for row in legacy_rows:
        email = row["email_id"]
        runner_id = runner_map.get(email)
        if not runner_id:
            unmapped.add(email)
            continue
        records.append(
            {
                "runner_id": runner_id,
                "season": row["season"],
                "meso": row["meso"],
                "qual_score": row["qual"],
                "source_table": "rhwb_meso_scores",
            }
        )

    print(f"  Prepared {len(records)} records for upsert")
    if unmapped:
        print(f"  WARNING: {len(unmapped)} email(s) had no runner_id mapping:")
        for e in sorted(unmapped):
            print(f"    - {e}")

    # 6. Upsert into Cloud SQL
    print("6. Connecting to Cloud SQL and upserting...")
    conn = get_cloud_sql_conn()
    try:
        total = upsert_to_cloud_sql(conn, records)
        print(f"\n  Successfully upserted {total} records into Cloud SQL.")
    finally:
        conn.close()

    # 7. Verify
    print("\n7. Verification summary:")
    print(f"  rhwb_coach_input rows fetched:  {len(coach_input_rows)}")
    print(f"  rhwb_meso_scores legacy fetched: {len(legacy_rows)}")
    print(f"  Total source rows:               {len(coach_input_rows) + len(legacy_rows)}")
    print(f"  Records upserted to Cloud SQL:   {total}")
    print(f"  Unmapped emails (skipped):       {len(unmapped)}")

    if total == len(records):
        print("\n  Migration completed successfully.")
    else:
        print("\n  WARNING: Upsert count does not match prepared records.")
        sys.exit(1)


if __name__ == "__main__":
    main()
