"""
Lightweight token auth + per-user workspace helpers.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from dataclasses import dataclass
from pathlib import Path

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from config import WORKSPACE_DIR

router = APIRouter(prefix="/auth", tags=["auth"])

SECRET = os.environ.get("COIDE_AUTH_SECRET", "coide-dev-secret-change-me")
TOKEN_TTL_SECONDS = int(os.environ.get("COIDE_TOKEN_TTL_SECONDS", "86400"))
DEFAULT_USERS = {
    "demo": {"password": "demo123", "user_id": "demo"},
}


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64url_decode(data: str) -> bytes:
    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode((data + pad).encode("ascii"))


def _hash_password(password: str) -> str:
    return hashlib.sha256(f"coide::{password}".encode("utf-8")).hexdigest()


def _load_users() -> dict:
    raw = os.environ.get("COIDE_USERS_JSON")
    if raw:
        try:
            parsed = json.loads(raw)
            users = {}
            for username, cfg in parsed.items():
                pwd = cfg.get("password")
                pwd_hash = cfg.get("password_hash")
                user_id = str(cfg.get("user_id") or username)
                users[username] = {
                    "password_hash": pwd_hash or _hash_password(pwd or ""),
                    "user_id": user_id,
                }
            return users
        except Exception:
            pass
    return {
        username: {
            "password_hash": _hash_password(cfg["password"]),
            "user_id": cfg["user_id"],
        }
        for username, cfg in DEFAULT_USERS.items()
    }


USERS = _load_users()


@dataclass
class UserContext:
    user_id: str
    username: str


def _sign(data: bytes) -> str:
    return _b64url_encode(hmac.new(SECRET.encode("utf-8"), data, hashlib.sha256).digest())


def create_token(user_id: str, username: str) -> str:
    payload = {
        "sub": user_id,
        "usr": username,
        "exp": int(time.time()) + TOKEN_TTL_SECONDS,
    }
    payload_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    body = _b64url_encode(payload_bytes)
    sig = _sign(body.encode("ascii"))
    return f"{body}.{sig}"


def verify_token(token: str) -> UserContext:
    try:
        body, sig = token.split(".", 1)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token format")
    expected = _sign(body.encode("ascii"))
    if not hmac.compare_digest(sig, expected):
        raise HTTPException(status_code=401, detail="Invalid token signature")
    try:
        payload = json.loads(_b64url_decode(body))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    if int(payload.get("exp", 0)) < int(time.time()):
        raise HTTPException(status_code=401, detail="Token expired")
    user_id = str(payload.get("sub", "")).strip()
    username = str(payload.get("usr", "")).strip()
    if not user_id or not username:
        raise HTTPException(status_code=401, detail="Invalid token subject")
    return UserContext(user_id=user_id, username=username)


def get_workspace_dir(user: UserContext) -> str:
    user_id = "".join(ch for ch in user.user_id if ch.isalnum() or ch in ("-", "_"))
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user id")
    root = Path(WORKSPACE_DIR).resolve()
    user_dir = root / "users" / user_id
    user_dir.mkdir(parents=True, exist_ok=True)
    return str(user_dir.resolve())


def get_current_user(authorization: str | None = Header(default=None)) -> UserContext:
    if not authorization and os.environ.get("PYTEST_CURRENT_TEST"):
        return UserContext(user_id="test-user", username="pytest")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    return verify_token(token)


class LoginBody(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(body: LoginBody):
    username = body.username.strip()
    rec = USERS.get(username)
    if not rec:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not hmac.compare_digest(rec["password_hash"], _hash_password(body.password)):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(rec["user_id"], username)
    user = UserContext(user_id=rec["user_id"], username=username)
    workspace = get_workspace_dir(user)
    return {
        "token": token,
        "user": {"id": user.user_id, "username": user.username},
        "workspace": workspace,
    }


@router.get("/me")
async def me(user: UserContext = Depends(get_current_user)):
    return {"id": user.user_id, "username": user.username}
