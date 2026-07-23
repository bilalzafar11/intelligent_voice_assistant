"""Application entry point for the Intelligent Voice Assistant API."""

from contextlib import asynccontextmanager
from typing import AsyncIterator

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router
from config import API_TITLE, API_VERSION, UPLOAD_DIR


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Initialize resources when the server starts."""
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    yield


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=API_TITLE,
        version=API_VERSION,
        description="Intelligent Voice Assistant for Student Marks Entry",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router)

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


app = create_app()


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)