import logging
import uuid
from datetime import date as date_type
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.database import get_db
from app.deps import DoctorUser, get_current_user
from app.models import Consultation, LabAnalysis, LabIndicator, Patient, User, UserRole
from app.schemas import LabAnalysisListOut, LabAnalysisOut, LabIndicatorOut
from app.services.gemini_lab_service import (
    analyze_lab_document,
    friendly_gemini_error,
    patient_context_from_model,
)
from app.services.lab_analysis_pdf import build_lab_analysis_pdf

router = APIRouter(prefix="/lab-analyses", tags=["lab-analyses"])
_logger = logging.getLogger(__name__)

_ALLOWED_MIME = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/jpg",
}
_EXT_BY_MIME = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def _upload_root() -> Path:
    if settings.lab_upload_dir.strip():
        root = Path(settings.lab_upload_dir)
    else:
        root = Path(__file__).resolve().parents[2] / "uploads" / "lab"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _ensure_patient_access(db: Session, user: User, patient_id: int) -> Patient:
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Пациент не найден")
    if user.role == UserRole.doctor and p.doctor_id != user.id:
        raise HTTPException(status_code=403, detail="Нет доступа к пациенту")
    return p


def _latest_diagnosis(db: Session, patient_id: int) -> str | None:
    c = (
        db.query(Consultation)
        .filter(Consultation.patient_id == patient_id)
        .order_by(Consultation.visit_at.desc())
        .first()
    )
    if not c or not isinstance(c.diagnoses_json, dict):
        return None
    doc = c.diagnoses_json.get("doctor_diagnosis")
    if isinstance(doc, str) and doc.strip():
        return doc.strip()
    preds = c.diagnoses_json.get("predictions")
    if isinstance(preds, list) and preds:
        first = preds[0]
        if isinstance(first, dict) and first.get("disease"):
            return str(first["disease"])
    return None


def _parse_test_date(value: str | None) -> date_type | None:
    if not value:
        return None
    try:
        return date_type.fromisoformat(value[:10])
    except ValueError:
        return None


def _indicator_sort_key(ind: LabIndicator) -> tuple:
    return (0 if ind.status in ("normal", "unknown") else 1, ind.name)


def _row_to_out(row: LabAnalysis) -> LabAnalysisOut:
    lab_name = None
    if isinstance(row.extracted_json, dict):
        lab_name = row.extracted_json.get("lab_name")

    if row.indicators:
        indicators = [
            LabIndicatorOut.model_validate(i)
            for i in sorted(row.indicators, key=_indicator_sort_key)
        ]
    elif isinstance(row.extracted_json, dict):
        indicators = [
            LabIndicatorOut(**item)
            for item in row.extracted_json.get("indicators", [])
            if isinstance(item, dict)
        ]
    else:
        indicators = []

    return LabAnalysisOut(
        id=row.id,
        patient_id=row.patient_id,
        doctor_id=row.doctor_id,
        original_filename=row.original_filename,
        mime_type=row.mime_type,
        test_type=row.test_type,
        test_date=row.test_date,
        lab_name=lab_name,
        extracted_json=row.extracted_json,
        ai_interpretation=row.ai_interpretation,
        flagged_count=row.flagged_count,
        total_count=row.total_count,
        status=row.status,
        indicators=indicators,
        created_at=row.created_at,
    )


def _get_analysis(db: Session, user: User, analysis_id: int) -> LabAnalysis:
    row = (
        db.query(LabAnalysis)
        .options(joinedload(LabAnalysis.indicators))
        .filter(LabAnalysis.id == analysis_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Анализ не найден")
    patient = db.query(Patient).filter(Patient.id == row.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Пациент не найден")
    if user.role == UserRole.doctor and patient.doctor_id != user.id:
        raise HTTPException(status_code=403, detail="Нет доступа")
    return row


@router.get("", response_model=list[LabAnalysisListOut])
def list_lab_analyses(
    patient_id: int = Query(..., description="ID пациента"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_patient_access(db, user, patient_id)
    rows = (
        db.query(LabAnalysis)
        .filter(LabAnalysis.patient_id == patient_id)
        .order_by(LabAnalysis.created_at.desc())
        .all()
    )
    return [
        LabAnalysisListOut(
            id=r.id,
            patient_id=r.patient_id,
            original_filename=r.original_filename,
            test_type=r.test_type,
            test_date=r.test_date,
            uploaded_at=r.created_at,
            flagged_count=r.flagged_count or 0,
            total_count=r.total_count or 0,
            status=r.status or "done",
        )
        for r in rows
    ]


@router.get("/{analysis_id}", response_model=LabAnalysisOut)
def get_lab_analysis(
    analysis_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _row_to_out(_get_analysis(db, user, analysis_id))


@router.get("/{analysis_id}/pdf")
def lab_analysis_pdf(
    analysis_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _get_analysis(db, user, analysis_id)
    if row.status != "done":
        raise HTTPException(status_code=400, detail="Отчёт доступен только для обработанных анализов")

    patient = db.query(Patient).filter(Patient.id == row.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Пациент не найден")

    doctor = db.query(User).filter(User.id == row.doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Врач не найден")

    try:
        pdf_bytes = build_lab_analysis_pdf(row, patient, doctor)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    date_part = row.test_date.isoformat() if row.test_date else row.created_at.strftime("%Y-%m-%d")
    filename = f"lab-analysis-{row.id}-{date_part}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("", response_model=LabAnalysisOut)
async def upload_lab_analysis(
    user: DoctorUser,
    db: Session = Depends(get_db),
    patient_id: int = Form(...),
    file: UploadFile = File(...),
):
    patient = _ensure_patient_access(db, user, patient_id)

    if not file.filename:
        raise HTTPException(status_code=400, detail="Файл не загружен")

    mime = (file.content_type or "").split(";")[0].strip().lower()
    if mime not in _ALLOWED_MIME:
        raise HTTPException(
            status_code=400,
            detail="Только PDF и изображения (JPG, PNG, WEBP)",
        )

    data = await file.read()
    max_bytes = settings.lab_upload_max_mb * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"Файл слишком большой (макс. {settings.lab_upload_max_mb} МБ)",
        )
    if len(data) < 100:
        raise HTTPException(status_code=400, detail="Файл пустой или повреждён")

    row = LabAnalysis(
        patient_id=patient_id,
        doctor_id=user.id,
        original_filename=file.filename,
        mime_type=mime,
        file_path="",
        status="pending",
    )
    db.add(row)
    db.flush()

    ext = _EXT_BY_MIME.get(mime, Path(file.filename).suffix or ".bin")
    stored_name = f"{uuid.uuid4().hex}{ext}"
    dest_dir = _upload_root() / str(patient_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / stored_name
    dest_path.write_bytes(data)
    row.file_path = str(dest_path)

    try:
        ctx = patient_context_from_model(patient, _latest_diagnosis(db, patient_id))
        extracted, interpretation = analyze_lab_document(data, mime, ctx)
    except RuntimeError as exc:
        row.status = "error"
        db.commit()
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        row.status = "error"
        db.commit()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        row.status = "error"
        db.commit()
        _logger.exception("Lab analysis Gemini failed for patient %s", patient_id)
        raise HTTPException(
            status_code=502,
            detail=friendly_gemini_error(exc),
        ) from exc

    row.test_type = extracted.get("test_type")
    row.test_date = _parse_test_date(extracted.get("test_date"))
    row.extracted_json = extracted
    row.ai_interpretation = interpretation
    row.flagged_count = extracted.get("flagged_count", 0)
    row.total_count = extracted.get("total_count", 0)
    row.status = "done"

    for ind in extracted.get("indicators", []):
        db.add(
            LabIndicator(
                lab_analysis_id=row.id,
                name=ind["name"],
                name_en=ind.get("name_en"),
                value=ind["value"],
                unit=ind.get("unit"),
                ref_min=ind.get("ref_min"),
                ref_max=ind.get("ref_max"),
                status=ind["status"],
                deviation_pct=ind.get("deviation_pct"),
            )
        )

    db.commit()
    db.refresh(row)
    row = _get_analysis(db, user, row.id)
    return _row_to_out(row)
