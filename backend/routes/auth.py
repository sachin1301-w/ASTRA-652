import hashlib

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import delete
from sqlalchemy import select

from models.db import AuthSession, User, UserProfile, get_session
from models.schemas import LoginRequest, LoginResponse, RegisterRequest, UserOut
from services.security import bearer, create_session, get_current_user, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

DEMO_USERS = (
    {"id": "demo-user-001", "name": "Rahul Sharma", "email": "demo@finlens.ai", "password": "123456"},
    {"id": "paytm-user-001", "name": "Aarav Mehta", "email": "paytm@finlens.ai", "password": "Paytm@123"},
)


def seed_demo_users() -> None:
    with get_session() as session:
        for item in DEMO_USERS:
            user = session.scalar(select(User).where(User.email == item["email"]))
            if user is None:
                session.add(User(
                    id=item["id"], name=item["name"], email=item["email"],
                    password_hash=hash_password(item["password"]),
                ))
            if session.get(UserProfile, item["id"]) is None:
                session.add(UserProfile(user_id=item["id"], name=item["name"]))
        session.commit()


def _login_response(session, user: User, message: str) -> LoginResponse:
    token = create_session(session, user.id)
    session.commit()
    return LoginResponse(
        success=True,
        message=message,
        user=UserOut(id=user.id, name=user.name, email=user.email),
        access_token=token,
    )


@router.post("/register", response_model=LoginResponse, status_code=201)
def register(payload: RegisterRequest) -> LoginResponse:
    email = payload.email.lower().strip()
    with get_session() as session:
        if session.scalar(select(User).where(User.email == email)) is not None:
            raise HTTPException(status_code=409, detail="An account with this email already exists.")
        user = User(name=payload.name.strip(), email=email, password_hash=hash_password(payload.password))
        session.add(user)
        session.flush()
        session.add(UserProfile(user_id=user.id, name=user.name))
        return _login_response(session, user, "Account created successfully")


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    with get_session() as session:
        user = session.scalar(select(User).where(User.email == payload.email.lower().strip()))
        if user is None or not verify_password(payload.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        return _login_response(session, user, "Login successful")


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return UserOut(id=user.id, name=user.name, email=user.email)


@router.post("/logout")
def logout(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    if credentials is not None:
        token_hash = hashlib.sha256(credentials.credentials.encode()).hexdigest()
        with get_session() as session:
            session.execute(delete(AuthSession).where(AuthSession.token_hash == token_hash))
            session.commit()
    return {"success": True}
