import enum
from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    doctor = "doctor"
    admin = "admin"


class Gender(str, enum.Enum):
    male = "male"
    female = "female"
    other = "other"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(128), nullable=True)

    patients: Mapped[list["Patient"]] = relationship(back_populates="doctor")
    consultations: Mapped[list["Consultation"]] = relationship(
        back_populates="doctor", foreign_keys="Consultation.doctor_id"
    )


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(128))
    age: Mapped[int] = mapped_column(Integer)
    gender: Mapped[Gender] = mapped_column(Enum(Gender), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    email: Mapped[str | None] = mapped_column(String(256), nullable=True)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    policy_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    emergency_contact_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    allergies: Mapped[str | None] = mapped_column(Text, nullable=True)
    chronic_conditions: Mapped[str | None] = mapped_column(Text, nullable=True)
    patient_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    doctor: Mapped["User"] = relationship(back_populates="patients")
    consultations: Mapped[list["Consultation"]] = relationship(back_populates="patient")
    lab_analyses: Mapped[list["LabAnalysis"]] = relationship(back_populates="patient")


class Consultation(Base):
    __tablename__ = "consultations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    visit_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    next_visit_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    symptoms_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    clarifications_json: Mapped[list | dict | None] = mapped_column(JSON, nullable=True)
    diagnoses_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    diagnosis_feedback: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    patient: Mapped["Patient"] = relationship(back_populates="consultations")
    doctor: Mapped["User"] = relationship(
        back_populates="consultations", foreign_keys=[doctor_id]
    )


class LabAnalysis(Base):
    __tablename__ = "lab_analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    original_filename: Mapped[str] = mapped_column(String(256))
    mime_type: Mapped[str] = mapped_column(String(64))
    file_path: Mapped[str] = mapped_column(String(512))
    test_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    test_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    extracted_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ai_interpretation: Mapped[str | None] = mapped_column(Text, nullable=True)
    flagged_count: Mapped[int] = mapped_column(Integer, default=0)
    total_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="done")
    interpretation_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    patient: Mapped["Patient"] = relationship(back_populates="lab_analyses")
    indicators: Mapped[list["LabIndicator"]] = relationship(
        back_populates="lab_analysis", cascade="all, delete-orphan"
    )


class LabIndicator(Base):
    __tablename__ = "lab_indicators"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lab_analysis_id: Mapped[int] = mapped_column(ForeignKey("lab_analyses.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    name_en: Mapped[str | None] = mapped_column(String(100), nullable=True)
    value: Mapped[float] = mapped_column(Float)
    unit: Mapped[str | None] = mapped_column(String(30), nullable=True)
    ref_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    ref_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(20))
    deviation_pct: Mapped[float | None] = mapped_column(Float, nullable=True)

    lab_analysis: Mapped["LabAnalysis"] = relationship(back_populates="indicators")
