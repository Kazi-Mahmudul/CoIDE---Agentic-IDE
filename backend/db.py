"""
PostgreSQL database helpers + lightweight SQL migration runner.
"""

from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path

from dotenv import find_dotenv, load_dotenv
import psycopg
from psycopg.rows import dict_row

load_dotenv(find_dotenv())

_BACKEND_DIR = Path(__file__).resolve().parent
_MIGRATIONS_DIR = _BACKEND_DIR / "migrations"

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()


def require_database_url() -> str:
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is required for authentication and persistence")
    return DATABASE_URL


@contextmanager
def get_conn(autocommit: bool = False):
    conn = psycopg.connect(require_database_url(), autocommit=autocommit, row_factory=dict_row)
    try:
        yield conn
    finally:
        conn.close()


def apply_migrations():
    _MIGRATIONS_DIR.mkdir(parents=True, exist_ok=True)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version TEXT PRIMARY KEY,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute("SELECT version FROM schema_migrations")
            applied = {row["version"] for row in cur.fetchall()}

            for path in sorted(_MIGRATIONS_DIR.glob("*.sql")):
                version = path.name
                if version in applied:
                    continue
                sql = path.read_text(encoding="utf-8")
                cur.execute(sql)
                cur.execute(
                    "INSERT INTO schema_migrations (version) VALUES (%s)",
                    (version,),
                )
        conn.commit()

