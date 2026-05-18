"""
PostgreSQL database helpers + lightweight SQL migration runner.
"""

from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path

try:
    from dotenv import find_dotenv, load_dotenv
except Exception:  # pragma: no cover - optional in serverless/runtime envs
    find_dotenv = None
    load_dotenv = None
import psycopg
from psycopg.rows import dict_row

if load_dotenv and find_dotenv:
    load_dotenv(find_dotenv())

_BACKEND_DIR = Path(__file__).resolve().parent
_MIGRATIONS_DIR = _BACKEND_DIR / "migrations"

def require_database_url() -> str:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise RuntimeError("DATABASE_URL is required for authentication and persistence")
    return database_url


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
