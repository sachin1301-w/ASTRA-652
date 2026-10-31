from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import re

from config import settings
from models.db import init_db
from routes import assistant, auth, cognee, convai, documents, finance, profile, speech

app = FastAPI(
    title="FinLens AI API",
    description="Gemini-powered document intelligence and financial guidance for FinLens AI.",
    version="1.0.0",
)


class PathNormalizeMiddleware:
    """Normalize duplicate slashes (e.g. //api/...) and redundant /api prefixes."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "http":
            raw_path = scope.get("path", "")
            clean = re.sub(r"/+", "/", raw_path)
            if clean.startswith("/api/api/"):
                clean = clean[4:]
            scope["path"] = clean
            scope["raw_path"] = clean.encode("utf-8")
        await self.app(scope, receive, send)


app.add_middleware(PathNormalizeMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()
    auth.seed_demo_users()


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": exc.detail},
    )


app.include_router(auth.router)
app.include_router(assistant.router)
app.include_router(cognee.router)
app.include_router(convai.router)
app.include_router(documents.router)
app.include_router(finance.router)
app.include_router(profile.router)
app.include_router(speech.router)


@app.get("/")
def root():
    return {
        "success": True,
        "message": "FinLens AI Backend API is live.",
        "docs": "/docs",
        "health": "/api/health",
    }


@app.get("/api/health")
def health_check():
    return {"success": True, "message": "FinLens AI backend is running."}

