from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import DoctorUser
from app.models import Consultation, Patient
from app.schemas import DoctorSummaryOut, UpcomingVisitOut

router = APIRouter(prefix="/doctor", tags=["doctor"])


def _to_naive_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


@router.get("/summary", response_model=DoctorSummaryOut)
def doctor_summary(user: DoctorUser, db: Session = Depends(get_db)):
    now = _to_naive_utc(datetime.now(timezone.utc))
    week_ago = now - timedelta(days=7)

    patients_total = db.query(Patient).filter(Patient.doctor_id == user.id).count()
    consultations_total = db.query(Consultation).filter(Consultation.doctor_id == user.id).count()
    consultations_last_7_days = (
        db.query(Consultation)
        .filter(Consultation.doctor_id == user.id, Consultation.visit_at >= week_ago)
        .count()
    )

    upcoming_q = (
        db.query(Consultation, Patient.name)
        .join(Patient, Patient.id == Consultation.patient_id)
        .filter(
            Consultation.doctor_id == user.id,
            Consultation.next_visit_date.isnot(None),
            Consultation.next_visit_date >= now,
        )
        .order_by(Consultation.next_visit_date.asc(), Consultation.id.asc())
        .limit(12)
    )
    upcoming: list[UpcomingVisitOut] = []
    for c, pname in upcoming_q.all():
        nv = c.next_visit_date
        if nv is None:
            continue
        upcoming.append(
            UpcomingVisitOut(
                consultation_id=c.id,
                patient_id=c.patient_id,
                patient_name=str(pname),
                next_visit_date=nv,
            )
        )

    return DoctorSummaryOut(
        patients_total=patients_total,
        consultations_total=consultations_total,
        consultations_last_7_days=consultations_last_7_days,
        upcoming_visits=upcoming,
    )
