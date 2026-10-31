import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select

from models.db import AuthSession, User, get_session

PASSWORD_ITERATIONS = 240_000
SESSION_DAYS = 7
bearer = HTTPBearer(auto_error=False)


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PASSWORD_ITERATIONS)
    return f"pbkdf2_sha256${PASSWORD_ITERATIONS}${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, iterations, salt, expected = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), base64.b64decode(salt), int(iterations)
        )
        return hmac.compare_digest(actual, base64.b64decode(expected))
    except (ValueError, TypeError):
        return False


def create_session(session, user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    session.add(AuthSession(
        token_hash=hashlib.sha256(token.encode()).hexdigest(),
        user_id=user_id,
        expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=SESSION_DAYS),
    ))
    return token


def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> User:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required.")
    token_hash = hashlib.sha256(credentials.credentials.encode()).hexdigest()
    with get_session() as session:
        auth_session = session.get(AuthSession, token_hash)
        if auth_session is None or auth_session.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
            raise HTTPException(status_code=401, detail="Your session has expired. Please log in again.")
        user = session.scalar(select(User).where(User.id == auth_session.user_id))
        if user is None:
            raise HTTPException(status_code=401, detail="Invalid session.")
        session.expunge(user)
        return user
