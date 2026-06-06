import re
from datetime import date as DateType

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import String, and_, cast, func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import DoctorUser, get_current_user
from app.models import Gender, Patient, User, UserRole
from app.schemas import PatientCreate, PatientOut, PatientUpdate

router = APIRouter(prefix="/patients", tags=["patients"])


def _age_from_birth(bd: DateType) -> int:
    today = DateType.today()
    age = today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))
    return max(0, min(age, 130))


def _strip_or_none(v: str | None) -> str | None:
    if v is None:
        return None
    s = v.strip()
    return s or None


def _normalize_search_tokens(q: str) -> list[str]:
    """Разбивает запрос на слова; лишние пробелы убираются."""
    return [t for t in re.split(r"\s+", q.strip().lower()) if t]


def _digits_only(value: str) -> str:
    return re.sub(r"\D", "", value)


def _phone_digits_column(column):
    """Оставляет в номере телефона только цифры (для поиска без форматирования)."""
    expr = func.coalesce(column, "")
    for ch in (" ", "-", "(", ")", "+"):
        expr = func.replace(expr, ch, "")
    return expr


def _apply_patient_search(query, q: str):
    """
    Поиск по ФИО (все слова запроса), телефону, email, полису, экстренному контакту.
    Слова объединяются через AND — «Иван Петров» найдёт и «Петров Иван».
    """
    raw = q.strip()
    if not raw:
        return query

    # Проверяем, является ли запрос преимущественно цифровым (телефон/полис)
    digits = _digits_only(raw)
    compact = re.sub(r"\s+", "", raw)
    
    # Если запрос состоит в основном из цифр (>= 50% символов - цифры) и содержит минимум 5 цифр
    if digits and len(digits) >= 5 and len(digits) / max(len(compact), 1) >= 0.5:
        digit_term = f"%{digits}%"
        return query.filter(
            or_(
                _phone_digits_column(Patient.phone).like(digit_term),
                _phone_digits_column(Patient.emergency_contact_phone).like(digit_term),
                cast(Patient.policy_number, String).like(digit_term),
            )
        )

    # Текстовый поиск
    tokens = _normalize_search_tokens(raw)
    if not tokens:
        return query

    # Создаем отдельные условия для разных групп полей
    text_conditions = []
    
    # Поиск по имени (разбиваем на слова и ищем каждое)
    name_tokens = []
    for token in tokens:
        name_tokens.append(func.lower(Patient.name).like(f"%{token}%"))
    
    # Поиск по email
    email_tokens = []
    for token in tokens:
        email_tokens.append(func.lower(func.coalesce(Patient.email, "")).like(f"%{token}%"))
    
    # Поиск по имени экстренного контакта
    contact_tokens = []
    for token in tokens:
        contact_tokens.append(func.lower(func.coalesce(Patient.emergency_contact_name, "")).like(f"%{token}%"))
    
    # Объединяем: ищем совпадение всех токенов в имени ИЛИ в email ИЛИ в контакте
    query = query.filter(
        or_(
            and_(*name_tokens),      # Все токены в имени
            and_(*email_tokens),     # Все токены в email
            and_(*contact_tokens),   # Все токены в имени контакта
        )
    )
    
    return query

@router.post("", response_model=PatientOut)
def create_patient(body: PatientCreate, user: DoctorUser, db: Session = Depends(get_db)):
    try:
        g = Gender(body.gender)
    except ValueError:
        raise HTTPException(status_code=400, detail="Некорректный пол")
    p = Patient(
        doctor_id=user.id,
        name=body.name.strip(),
        age=_age_from_birth(body.birth_date),
        gender=g,
        birth_date=body.birth_date,
        phone=body.phone.strip(),
        email=_strip_or_none(body.email),
        address=_strip_or_none(body.address),
        policy_number=_strip_or_none(body.policy_number),
        emergency_contact_name=body.emergency_contact_name.strip(),
        emergency_contact_phone=body.emergency_contact_phone.strip(),
        allergies=_strip_or_none(body.allergies),
        chronic_conditions=_strip_or_none(body.chronic_conditions),
        patient_notes=_strip_or_none(body.patient_notes),
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.get("", response_model=list[PatientOut])
def list_patients(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    doctor_id: int | None = Query(None),
    q: str | None = Query(
        None,
        max_length=128,
        description="Поиск по ФИО, телефону, email, полису",
    ),
):
    if user.role == UserRole.admin:
        query = db.query(Patient)
        if doctor_id is not None:
            query = query.filter(Patient.doctor_id == doctor_id)
    else:
        query = db.query(Patient).filter(Patient.doctor_id == user.id)

    if q and q.strip():
        query = _apply_patient_search(query, q)

    return query.order_by(Patient.name.asc(), Patient.created_at.desc()).all()


@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(patient_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Пациент не найден")
    if user.role == UserRole.doctor and p.doctor_id != user.id:
        raise HTTPException(status_code=403, detail="Нет доступа")
    return p


@router.patch("/{patient_id}", response_model=PatientOut)
def update_patient(
    patient_id: int,
    body: PatientUpdate,
    user: DoctorUser,
    db: Session = Depends(get_db),
):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p or p.doctor_id != user.id:
        raise HTTPException(status_code=404, detail="Пациент не найден")
    data = body.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="Укажите хотя бы одно поле")

    if "name" in data:
        p.name = data["name"].strip()
    if "gender" in data:
        try:
            p.gender = Gender(data["gender"])
        except ValueError:
            raise HTTPException(status_code=400, detail="Некорректный пол")
    if "birth_date" in data:
        bd = data["birth_date"]
        p.birth_date = bd
        if bd is not None:
            p.age = _age_from_birth(bd)
    if "age" in data and "birth_date" not in data:
        p.age = data["age"]
    if "phone" in data and data["phone"] is not None:
        p.phone = data["phone"].strip()
    if "email" in data:
        p.email = _strip_or_none(data["email"])
    if "address" in data:
        p.address = _strip_or_none(data["address"])
    if "policy_number" in data:
        p.policy_number = _strip_or_none(data["policy_number"])
    if "emergency_contact_name" in data and data["emergency_contact_name"] is not None:
        p.emergency_contact_name = data["emergency_contact_name"].strip()
    if "emergency_contact_phone" in data and data["emergency_contact_phone"] is not None:
        p.emergency_contact_phone = data["emergency_contact_phone"].strip()
    if "allergies" in data:
        p.allergies = _strip_or_none(data["allergies"])
    if "chronic_conditions" in data:
        p.chronic_conditions = _strip_or_none(data["chronic_conditions"])
    if "patient_notes" in data:
        p.patient_notes = _strip_or_none(data["patient_notes"])

    db.commit()
    db.refresh(p)
    return p
