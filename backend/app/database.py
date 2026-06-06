from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import settings


class Base(DeclarativeBase):
    pass


def _default_database_url() -> str:
    return settings.database_url


_url = _default_database_url()
engine = create_engine(
    _url,
    pool_pre_ping=True,
    pool_recycle=3600,
    connect_args={"check_same_thread": False} if _url.startswith("sqlite") else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ml_artifacts_dir() -> Path:
    if settings.ml_dir:
        return Path(settings.ml_dir)
    return Path(__file__).resolve().parent.parent / "ml_artifacts"
