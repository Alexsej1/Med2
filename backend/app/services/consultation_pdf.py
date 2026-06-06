"""Генерация PDF консультации формата A4 (русский текст)."""

from __future__ import annotations

import io
from datetime import date, datetime
from pathlib import Path

from fpdf import FPDF

from app.models import Consultation, Gender, Patient, User

_CLINIC_NAME = "MedExpert — медицинский центр"
_ACCENT = (78, 103, 235)
_ACCENT_LIGHT = (238, 241, 253)
_TEXT_MUTED = (90, 95, 120)
_TEXT_BODY = (40, 44, 62)
_GENDER_RU = {
    Gender.male: "Мужской",
    Gender.female: "Женский",
    Gender.other: "Другой",
}


def _font_candidates() -> list[Path]:
    assets = Path(__file__).resolve().parents[1] / "assets" / "fonts"
    return [
        assets / "DejaVuSans.ttf",
        Path(r"C:\Windows\Fonts\arial.ttf"),
        Path(r"C:\Windows\Fonts\Arial.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        Path("/usr/share/fonts/TTF/DejaVuSans.ttf"),
        Path("/usr/share/fonts/dejavu/DejaVuSans.ttf"),
    ]


def _resolve_font() -> Path:
    for path in _font_candidates():
        if path.is_file():
            return path
    raise FileNotFoundError(
        "Не найден шрифт с поддержкой кириллицы. "
        "Положите DejaVuSans.ttf в backend/app/assets/fonts/ "
        "или установите пакет fonts-dejavu-core (Linux)."
    )


def _format_visit_at(dt: datetime) -> str:
    if dt.tzinfo is not None:
        dt = dt.replace(tzinfo=None)
    months = (
        "января",
        "февраля",
        "марта",
        "апреля",
        "мая",
        "июня",
        "июля",
        "августа",
        "сентября",
        "октября",
        "ноября",
        "декабря",
    )
    return f"{dt.day} {months[dt.month - 1]} {dt.year}, {dt.strftime('%H:%M')}"


def _format_date(d: date | None) -> str:
    if d is None:
        return "—"
    months = (
        "января",
        "февраля",
        "марта",
        "апреля",
        "мая",
        "июня",
        "июля",
        "августа",
        "сентября",
        "октября",
        "ноября",
        "декабря",
    )
    return f"{d.day} {months[d.month - 1]} {d.year}"


def _icd10_line(diagnoses_json: dict | None) -> str | None:
    if not diagnoses_json or not isinstance(diagnoses_json, dict):
        return None
    code = diagnoses_json.get("icd10_code")
    if not isinstance(code, str) or not code.strip():
        return None
    code = code.strip()
    title_en = diagnoses_json.get("icd10_title_en")
    if isinstance(title_en, str) and title_en.strip():
        return f"{code} — {title_en.strip()}"
    title_ru = diagnoses_json.get("icd10_title_ru")
    if isinstance(title_ru, str) and title_ru.strip():
        return f"{code} — {title_ru.strip()}"
    return code


def _primary_diagnosis(diagnoses_json: dict | None) -> str | None:
    if not diagnoses_json or not isinstance(diagnoses_json, dict):
        return None
    doctor = diagnoses_json.get("doctor_diagnosis")
    if isinstance(doctor, str) and doctor.strip():
        return doctor.strip()
    preds = diagnoses_json.get("predictions")
    if not isinstance(preds, list) or not preds:
        return None
    raw = preds[0]
    if not isinstance(raw, dict):
        return None
    disease = raw.get("disease")
    if not disease:
        return None
    return str(disease).strip()


class _ConsultationPdf(FPDF):
    def __init__(self, font_path: Path) -> None:
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_auto_page_break(auto=True, margin=20)
        self.add_font("DocFont", "", str(font_path))

    def footer(self) -> None:
        self.set_y(-12)
        self.set_font("DocFont", size=8)
        self.set_text_color(*_TEXT_MUTED)
        self.cell(0, 6, f"Стр. {self.page_no()}/{{nb}}", align="C")

    def draw_header_band(self, visit_str: str, doctor_name: str) -> None:
        x0, w = self.l_margin, self.w - self.l_margin - self.r_margin
        y0 = self.get_y()
        h = 32

        self.set_fill_color(*_ACCENT)
        self.rect(x0, y0, w, h, style="F")

        self.set_xy(x0 + 6, y0 + 7)
        self.set_font("DocFont", size=15)
        self.set_text_color(255, 255, 255)
        self.cell(w - 12, 7, _CLINIC_NAME, new_x="LMARGIN", new_y="NEXT")

        self.set_x(x0 + 6)
        self.set_font("DocFont", size=10)
        self.set_text_color(220, 228, 255)
        self.cell(w - 12, 6, f"Консультация · {visit_str}", new_x="LMARGIN", new_y="NEXT")

        self.set_x(x0 + 6)
        self.cell(w - 12, 6, f"Врач: {doctor_name}", new_x="LMARGIN", new_y="NEXT")

        self.set_y(y0 + h + 8)
        self.set_text_color(*_TEXT_BODY)

    def section_block(self, title: str, content: str, *, highlight: bool = False) -> None:
        x0 = self.l_margin
        w = self.w - self.l_margin - self.r_margin
        pad = 5
        line_h = 5.5

        self.set_font("DocFont", size=10)
        self.set_x(x0)
        content_lines = self.multi_cell(w - 2 * pad, line_h, content, dry_run=True, output="LINES")
        if isinstance(content_lines, str):
            content_lines = [content_lines]
        text_h = max(line_h, len(content_lines) * line_h)
        block_h = 9 + text_h + pad

        y0 = self.get_y()
        if y0 + block_h > self.h - self.b_margin:
            self.add_page()
            y0 = self.get_y()

        fill = _ACCENT_LIGHT if highlight else (248, 249, 252)
        self.set_fill_color(*fill)
        self.set_draw_color(220, 224, 235)
        self.rect(x0, y0, w, block_h, style="FD")

        # Акцентная полоска слева
        self.set_fill_color(*_ACCENT)
        self.rect(x0, y0, 2.5, block_h, style="F")

        self.set_xy(x0 + pad + 2, y0 + 4)
        self.set_font("DocFont", size=9)
        self.set_text_color(*_ACCENT)
        self.cell(w - 2 * pad - 2, 5, title.upper(), new_x="LMARGIN", new_y="NEXT")

        self.set_xy(x0 + pad + 2, y0 + 10)
        self.set_font("DocFont", size=11 if highlight else 10)
        self.set_text_color(*_TEXT_BODY)
        self.multi_cell(w - 2 * pad - 2, line_h, content)

        self.set_y(y0 + block_h + 5)
        self.set_text_color(*_TEXT_BODY)

    def patient_grid(self, rows: list[tuple[str, str]]) -> None:
        x0 = self.l_margin
        w = self.w - self.l_margin - self.r_margin
        col_w = w / 2
        y_start = self.get_y()

        self.set_font("DocFont", size=9)
        self.set_text_color(*_TEXT_MUTED)
        self.set_x(x0)
        self.cell(w, 5, "ДАННЫЕ ПАЦИЕНТА", new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

        for i, (label, value) in enumerate(rows):
            col = i % 2
            row = i // 2
            x = x0 + col * col_w
            y = y_start + 8 + row * 14

            self.set_xy(x, y)
            self.set_font("DocFont", size=8)
            self.set_text_color(*_TEXT_MUTED)
            self.cell(col_w - 4, 4, label)

            self.set_xy(x, y + 4.5)
            self.set_font("DocFont", size=10)
            self.set_text_color(*_TEXT_BODY)
            self.multi_cell(col_w - 4, 5, value or "—")

        rows_count = (len(rows) + 1) // 2
        self.set_y(y_start + 8 + rows_count * 14 + 4)


def build_consultation_pdf(
    consultation: Consultation,
    patient: Patient,
    doctor: User,
) -> bytes:
    font_path = _resolve_font()
    pdf = _ConsultationPdf(font_path)
    pdf.alias_nb_pages()
    pdf.add_page()
    pdf.set_margins(16, 16, 16)

    doctor_name = (doctor.full_name or doctor.username).strip()
    visit_str = _format_visit_at(consultation.visit_at)

    pdf.draw_header_band(visit_str, doctor_name)

    gender = _GENDER_RU.get(patient.gender, str(patient.gender))
    patient_rows: list[tuple[str, str]] = [
        ("ФИО", patient.name),
        ("Возраст", f"{patient.age} лет"),
        ("Пол", gender),
    ]
    if patient.policy_number:
        patient_rows.append(("Полис", patient.policy_number))
    if patient.phone:
        patient_rows.append(("Телефон", patient.phone))
    if patient.birth_date:
        patient_rows.append(("Дата рождения", _format_date(patient.birth_date)))
    if patient.allergies:
        patient_rows.append(("Аллергии", patient.allergies.strip()))
    if patient.chronic_conditions:
        patient_rows.append(("Хронические заболевания", patient.chronic_conditions.strip()))

    pdf.patient_grid(patient_rows)
    pdf.ln(2)

    diagnosis = _primary_diagnosis(consultation.diagnoses_json)
    if diagnosis:
        icd = _icd10_line(consultation.diagnoses_json)
        body = diagnosis if not icd else f"{diagnosis}\nМКБ-10: {icd}"
        pdf.section_block("Диагноз", body, highlight=True)

    notes = (consultation.notes or "").strip()
    if notes:
        pdf.section_block("Заметки врача и рекомендации", notes)

    next_text = (
        _format_visit_at(consultation.next_visit_date)
        if consultation.next_visit_date
        else "Не назначен"
    )
    pdf.section_block("Следующий визит", next_text)

    pdf.ln(4)
    pdf.set_font("DocFont", size=8)
    pdf.set_text_color(*_TEXT_MUTED)
    pdf.set_x(pdf.l_margin)
    pdf.cell(
        0,
        4,
        f"Документ сформирован {datetime.now().strftime('%d.%m.%Y %H:%M')}",
        align="L",
    )

    buf = io.BytesIO()
    pdf.output(buf)
    return buf.getvalue()
