from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import DoctorUser
from app.models import Consultation, Patient
from app.schemas import UpcomingNotificationOut
from app.time_utils import is_within_upcoming_window, minutes_until_visit

router = APIRouter(prefix="/notifications", tags=["notifications"])

UPCOMING_WINDOW_MINUTES = 20


@router.get("/upcoming", response_model=list[UpcomingNotificationOut])
def upcoming_notifications(user: DoctorUser, db: Session = Depends(get_db)):
    rows = (
        db.query(Consultation, Patient.name)
        .join(Patient, Patient.id == Consultation.patient_id)
        .filter(
            Consultation.doctor_id == user.id,
            Consultation.next_visit_date.isnot(None),
        )
        .order_by(Consultation.next_visit_date.asc(), Consultation.id.asc())
        .all()
    )

    out: list[UpcomingNotificationOut] = []
    for c, pname in rows:
        nv = c.next_visit_date
        if nv is None:
            continue
        if not is_within_upcoming_window(nv, window_minutes=UPCOMING_WINDOW_MINUTES):
            continue
        out.append(
            UpcomingNotificationOut(
                consultation_id=c.id,
                patient_id=c.patient_id,
                patient_name=str(pname),
                next_visit_date=nv,
                minutes_until=minutes_until_visit(nv),
            )
        )
    return out
