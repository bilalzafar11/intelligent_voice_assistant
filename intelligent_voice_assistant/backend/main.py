"""Application entry point for the Intelligent Voice Assistant API."""

# pyright: reportMissingImports=false

import os
import socket
from contextlib import asynccontextmanager
from typing import AsyncIterator

try:
    import uvicorn  # type: ignore[import-not-found]
except ModuleNotFoundError:  # pragma: no cover
    uvicorn = None

import fastapi
import fastapi.middleware.cors

# ============================================================
# PROJECT IMPORTS
# ============================================================

from backend.api.auth_routes import router as auth_router
from backend.api.routes import router
from backend.config import API_TITLE, API_VERSION, UPLOAD_DIR
from database import Base, engine
import models  # noqa: F401


def get_available_port(start_port: int) -> int:
    """Return the requested port or the next free one if occupied."""
    for port in range(start_port, start_port + 20):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind(("0.0.0.0", port))
            except OSError:
                continue
            return port
    return start_port


@asynccontextmanager
async def lifespan(app: fastapi.FastAPI) -> AsyncIterator[None]:
    """Initialize resources when the server starts."""
    Base.metadata.create_all(bind=engine)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    yield


def create_app() -> fastapi.FastAPI:
    """Create and configure the FastAPI application."""
    app = fastapi.FastAPI(
        title=API_TITLE,
        version=API_VERSION,
        description="Intelligent Voice Assistant for Student Marks Entry",
        lifespan=lifespan,
    )

    # ========================================================
    # CORS CONFIGURATION
    # ========================================================
    app.add_middleware(
        fastapi.middleware.cors.CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ========================================================
    # API ROUTES
    # ========================================================
    app.include_router(router)
    app.include_router(auth_router)

    # ========================================================
    # HEALTH CHECK
    # ========================================================
    @app.get("/", tags=["Health"])
    def home() -> dict[str, str]:
        return {
            "message": "Welcome to Intelligent Voice Assistant API",
            "status": "Running",
        }

    @app.get("/health", tags=["Health"])
    def health_check() -> dict[str, str]:
        return {
            "status": "OK",
            "message": "Server is running successfully",
        }

    return app


# ============================================================
# APPLICATION INSTANCE
# ============================================================
app = create_app()

# ============================================================
# DIRECT EXECUTION
# ============================================================
if __name__ == "__main__":
    requested_port = int(os.getenv("PORT", "8000"))
    port = get_available_port(requested_port)

    if port != requested_port:
        print(
            f"Port {requested_port} is already in use. "
            f"Starting server on port {port} instead."
        )

    if uvicorn is not None:
        uvicorn.run(
            "backend.main:app",
            host="0.0.0.0",
            port=port,
            reload=True,
        )
