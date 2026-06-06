from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.auth_utils import hash_password
from app.database import get_db
from app.deps import AdminUser
from app.models import Consultation, Patient, User, UserRole
from app.schemas import ConsultationOut
from app.time_utils import normalize_visit_datetime, schedule_now_utc

router = APIRouter(prefix="/admin", tags=["admin"])


class DoctorCreateIn(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=6, max_length=128)
    full_name: str | None = Field(default=None, max_length=128)

    @field_validator("username")
    @classmethod
    def _username_strip(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Укажите логин")
        return s


class ConsultationAdminCreateIn(BaseModel):
    patient_id: int
    doctor_id: int
    visit_at: datetime | None = None
    next_visit_date: datetime | None = None
    notes: str | None = None
    symptom_keys: list[str] = []
    clarifications: list[dict] | None = None
    diagnoses: dict = Field(default_factory=dict)
    diagnosis_feedback: bool | None = None


@router.get("/doctors", response_model=list[dict])
def list_doctors(_: AdminUser, db: Session = Depends(get_db)):
    docs = db.query(User).filter(User.role == UserRole.doctor).order_by(User.full_name.asc(), User.username.asc()).all()
    out: list[dict] = []
    for u in docs:
        patients_count = db.query(Patient).filter(Patient.doctor_id == u.id).count()
        out.append(
            {
                "id": u.id,
                "username": u.username,
                "full_name": u.full_name,
                "patients_count": patients_count,
            }
        )
    return out


@router.post("/doctors", response_model=dict, status_code=201)
def create_doctor(body: DoctorCreateIn, _: AdminUser, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=400, detail="Пользователь с таким логином уже есть")
    u = User(
        username=body.username,
        hashed_password=hash_password(body.password),
        role=UserRole.doctor,
        full_name=body.full_name.strip() if body.full_name else None,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return {
        "id": u.id,
        "username": u.username,
        "full_name": u.full_name,
        "patients_count": 0,
    }


@router.post("/consultations", response_model=ConsultationOut)
def admin_create_consultation(
    body: ConsultationAdminCreateIn,
    _: AdminUser,
    db: Session = Depends(get_db),
):
    doc = db.query(User).filter(User.id == body.doctor_id, User.role == UserRole.doctor).first()
    if not doc:
        raise HTTPException(status_code=400, detail="Врач не найден")
    p = db.query(Patient).filter(Patient.id == body.patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Пациент не найден")
    visit = (
        normalize_visit_datetime(body.visit_at)
        if body.visit_at
        else schedule_now_utc()
    )
    next_visit = normalize_visit_datetime(body.next_visit_date)
    c = Consultation(
        patient_id=body.patient_id,
        doctor_id=body.doctor_id,
        visit_at=visit,
        next_visit_date=next_visit,
        notes=body.notes,
        symptoms_json=body.symptom_keys,
        clarifications_json=body.clarifications,
        diagnoses_json=body.diagnoses,
        diagnosis_feedback=body.diagnosis_feedback,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/consultations/{consultation_id}")
def admin_delete_consultation(consultation_id: int, _: AdminUser, db: Session = Depends(get_db)):
    c = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Не найдено")
    db.delete(c)
    db.commit()
    return {"ok": True}
