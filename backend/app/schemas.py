import json
from datetime import date, datetime, timedelta
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str
    role: str
    exp: int | None = None


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    full_name: str | None = None

    model_config = {"from_attributes": True}


class PatientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128, description="ФИО полностью")
    birth_date: date
    gender: str
    phone: str = Field(min_length=10, max_length=64, description="Контактный телефон")
    email: str | None = Field(None, max_length=256)
    address: str | None = Field(None, max_length=1024)
    policy_number: str | None = Field(None, max_length=128, description="Номер полиса ОМС / ДМС")
    emergency_contact_name: str = Field(min_length=2, max_length=256, description="ФИО контактного лица")
    emergency_contact_phone: str = Field(min_length=10, max_length=64)
    allergies: str | None = Field(None, max_length=4000)
    chronic_conditions: str | None = Field(None, max_length=4000)
    patient_notes: str | None = Field(None, max_length=4000, description="Общие заметки по карте")

    @field_validator("birth_date")
    @classmethod
    def _birth_date_ok(cls, v: date) -> date:
        today = date.today()
        if v > today:
            raise ValueError("Дата рождения не может быть в будущем")
        if v < today - timedelta(days=130 * 365):
            raise ValueError("Некорректная дата рождения")
        return v


class PatientOut(BaseModel):
    id: int
    doctor_id: int
    name: str
    age: int
    gender: str
    created_at: datetime
    phone: str | None = None
    email: str | None = None
    birth_date: date | None = None
    address: str | None = None
    policy_number: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    allergies: str | None = None
    chronic_conditions: str | None = None
    patient_notes: str | None = None

    model_config = {"from_attributes": True}


class PatientUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=128)
    age: int | None = Field(None, ge=0, le=130)
    gender: str | None = None
    birth_date: date | None = None
    phone: str | None = Field(None, min_length=10, max_length=64)
    email: str | None = Field(None, max_length=256)
    address: str | None = Field(None, max_length=1024)
    policy_number: str | None = Field(None, max_length=128)
    emergency_contact_name: str | None = Field(None, min_length=2, max_length=256)
    emergency_contact_phone: str | None = Field(None, min_length=10, max_length=64)
    allergies: str | None = Field(None, max_length=4000)
    chronic_conditions: str | None = Field(None, max_length=4000)
    patient_notes: str | None = Field(None, max_length=4000)

    @field_validator("birth_date")
    @classmethod
    def _birth_date_optional_ok(cls, v: date | None) -> date | None:
        if v is None:
            return v
        today = date.today()
        if v > today:
            raise ValueError("Дата рождения не может быть в будущем")
        if v < today - timedelta(days=130 * 365):
            raise ValueError("Некорректная дата рождения")
        return v


class UpcomingVisitOut(BaseModel):
    consultation_id: int
    patient_id: int
    patient_name: str
    next_visit_date: datetime


class UpcomingNotificationOut(BaseModel):
    consultation_id: int
    patient_id: int
    patient_name: str
    next_visit_date: datetime
    minutes_until: int


class DoctorSummaryOut(BaseModel):
    patients_total: int
    consultations_total: int
    consultations_last_7_days: int
    upcoming_visits: list[UpcomingVisitOut]


class SymptomInfluenceOut(BaseModel):
    symptom_key: str
    symptom_label: str
    weight: float


class DiagnosisItem(BaseModel):
    disease: str
    probability: float
    symptom_influences: list[SymptomInfluenceOut] = []
    icd10_code: str | None = None
    icd10_title_ru: str | None = None
    icd10_title_en: str | None = None


class DiagnoseRequest(BaseModel):
    symptom_keys: list[str]
    clarifications: list[dict] | None = None
    """Each item: {\"symptom_key\": str, \"present\": bool}"""


class DiagnoseResponse(BaseModel):
    predictions: list[DiagnosisItem]
    needs_clarification: bool
    clarifying_questions: list[dict] = []
    max_probability: float


class ConsultationCreate(BaseModel):
    patient_id: int
    visit_at: datetime | None = None
    next_visit_date: datetime | None = None
    notes: str | None = None
    symptom_keys: list[str]
    clarifications: list[dict] | None = None
    diagnoses: dict
    diagnosis_feedback: bool | None = None

    @model_validator(mode="after")
    def _require_doctor_diagnosis_when_ai_wrong(self):
        if self.diagnosis_feedback is False:
            raw = self.diagnoses.get("doctor_diagnosis") if isinstance(self.diagnoses, dict) else None
            if not isinstance(raw, str) or not raw.strip():
                raise ValueError("Укажите диагноз врача из списка, если ИИ ошибся")
        return self


class ConsultationOut(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    visit_at: datetime
    next_visit_date: datetime | None
    notes: str | None
    symptoms_json: list | None
    clarifications_json: list | dict | None
    diagnoses_json: dict | None
    diagnosis_feedback: bool | None
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("symptoms_json", mode="before")
    @classmethod
    def _coerce_symptoms_json(cls, v: Any) -> Any:
        if v is None or isinstance(v, list):
            return v
        if isinstance(v, (str, bytes)):
            return json.loads(v)
        return v

    @field_validator("clarifications_json", mode="before")
    @classmethod
    def _coerce_clarifications_json(cls, v: Any) -> Any:
        if v is None or isinstance(v, (list, dict)):
            return v
        if isinstance(v, (str, bytes)):
            return json.loads(v)
        return v

    @field_validator("diagnoses_json", mode="before")
    @classmethod
    def _coerce_diagnoses_json(cls, v: Any) -> Any:
        if v is None or isinstance(v, dict):
            return v
        if isinstance(v, (str, bytes)):
            return json.loads(v)
        return v


class ConsultationFeedback(BaseModel):
    diagnosis_feedback: bool


class CalendarDay(BaseModel):
    date: date
    consultations: list[ConsultationOut]


class SymptomSuggest(BaseModel):
    key: str
    label: str


class LabIndicatorOut(BaseModel):
    id: int | None = None
    name: str
    name_en: str | None = None
    value: float
    unit: str | None = None
    ref_min: float | None = None
    ref_max: float | None = None
    status: str
    deviation_pct: float | None = None

    model_config = {"from_attributes": True}


class LabAnalysisListOut(BaseModel):
    id: int
    patient_id: int
    original_filename: str
    test_type: str | None = None
    test_date: date | None = None
    uploaded_at: datetime
    flagged_count: int
    total_count: int
    status: str

    model_config = {"from_attributes": True}


class LabAnalysisOut(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    original_filename: str
    mime_type: str
    test_type: str | None = None
    test_date: date | None = None
    lab_name: str | None = None
    extracted_json: dict | None = None
    ai_interpretation: str | None = None
    flagged_count: int
    total_count: int
    status: str
    indicators: list[LabIndicatorOut] = []
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("extracted_json", mode="before")
    @classmethod
    def _coerce_extracted_json(cls, v: Any) -> Any:
        if v is None or isinstance(v, dict):
            return v
        if isinstance(v, (str, bytes)):
            return json.loads(v)
        return v
