from sqlalchemy import create_engine  # type: ignore[reportMissingImports]
from sqlalchemy.orm import declarative_base, sessionmaker  # type: ignore[reportMissingImports]
from pathlib import Path

DATABASE_PATH = Path(__file__).resolve().parent / "database" / "marks_database.db"
DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
DATABASE_URL = f"sqlite:///{DATABASE_PATH.as_posix()}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()