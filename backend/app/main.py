from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.auth_utils import hash_password
from app.database import Base, SessionLocal, engine
from app.db_migrate import (
    run_lab_analyses_columns,
    run_next_visit_datetime,
    run_patient_extended_columns,
)
from app.models import User, UserRole
from app.routers import (
    admin,
    auth,
    consultations,
    diagnose,
    diseases,
    doctor,
    icd10,
    lab_analyses,
    notifications,
    patients,
    symptoms,
)

API_PREFIX = "/api"


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    run_patient_extended_columns(engine)
    run_next_visit_datetime(engine)
    run_lab_analyses_columns(engine)
    db: Session = SessionLocal()
    try:
        if db.query(User).count() == 0:
            db.add(
                User(
                    username="doctor",
                    hashed_password=hash_password("doctor123"),
                    role=UserRole.doctor,
                    full_name="Доктор Иванов",
                )
            )
            db.add(
                User(
                    username="admin",
                    hashed_password=hash_password("admin123"),
                    role=UserRole.admin,
                    full_name="Администратор",
                )
            )
            db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    from app.config import settings
    from app.services.ml_service import ml_service

    ml_service.load()
    if not settings.gemini_api_key.strip():
        import logging

        logging.getLogger("uvicorn.error").warning(
            "TSAR_GEMINI_API_KEY не задан — загрузка лабораторных анализов недоступна. "
            "Создайте backend/.env (см. .env.example)"
        )
    yield


app = FastAPI(title="MedExpert — медицинский центр", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix=API_PREFIX)
api.include_router(auth.router)
api.include_router(patients.router)
api.include_router(doctor.router)
api.include_router(notifications.router)
api.include_router(consultations.router)
api.include_router(consultations.router_cal)
api.include_router(diagnose.router)
api.include_router(symptoms.router)
api.include_router(diseases.router)
api.include_router(icd10.router)
api.include_router(lab_analyses.router)
api.include_router(admin.router)
app.include_router(api)


@app.get("/health")
def health():
    from app.config import settings

    return {
        "status": "ok",
        "gemini_configured": bool(settings.gemini_api_key.strip()),
        "gemini_model": settings.gemini_model,
    }
