import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parents[1]
_ENV_CANDIDATES = (
    _BACKEND_DIR / ".env",
    Path.cwd() / ".env",
    Path.cwd() / "backend" / ".env",
)
_ENV_FILE = next((p for p in _ENV_CANDIDATES if p.is_file()), _BACKEND_DIR / ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="TSAR_",
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "sqlite:///./tsar.db"
    jwt_secret: str = "change-me-in-production-use-long-random-secret"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24
    diagnosis_confidence_threshold: float = 0.55
    ml_dir: str = ""
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    lab_upload_max_mb: int = 15
    lab_upload_dir: str = ""


def _resolve_gemini_api_key(settings: Settings) -> str:
    for key in (
        settings.gemini_api_key.strip(),
        os.getenv("TSAR_GEMINI_API_KEY", "").strip(),
        os.getenv("GEMINI_API_KEY", "").strip(),
    ):
        if key:
            return key
    return ""


settings = Settings()
settings.gemini_api_key = _resolve_gemini_api_key(settings)
