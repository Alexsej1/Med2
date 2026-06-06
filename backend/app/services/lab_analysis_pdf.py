"""PDF-отчёт по лабораторному анализу (таблица показателей + интерпретация)."""

from __future__ import annotations

import io
import re
from datetime import datetime

from fpdf import FPDF

from app.models import Gender, LabAnalysis, LabIndicator, Patient, User
from app.services.consultation_pdf import (
    _ACCENT,
    _ACCENT_LIGHT,
    _CLINIC_NAME,
    _TEXT_BODY,
    _TEXT_MUTED,
    _format_date,
    _resolve_font,
)

_GENDER_RU = {
    Gender.male: "Мужской",
    Gender.female: "Женский",
    Gender.other: "Другой",
}

_STATUS_RU = {
    "normal": "норма",
    "low": "понижен",
    "high": "повышен",
    "critical_low": "крит. низкий",
    "critical_high": "крит. высокий",
    "unknown": "—",
}


class _LabPdf(FPDF):
    def __init__(self, font_path) -> None:
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_auto_page_break(auto=True, margin=18)
        self.add_font("DocFont", "", str(font_path))

    def footer(self) -> None:
        self.set_y(-12)
        self.set_font("DocFont", size=8)
        self.set_text_color(*_TEXT_MUTED)
        self.cell(0, 6, f"Стр. {self.page_no()}/{{nb}}", align="C")


def _format_ref(ind: LabIndicator) -> str:
    unit = f" {ind.unit}" if ind.unit else ""
    if ind.ref_min is not None and ind.ref_max is not None:
        return f"{ind.ref_min}–{ind.ref_max}{unit}"
    if ind.ref_min is not None:
        return f"≥ {ind.ref_min}{unit}"
    if ind.ref_max is not None:
        return f"≤ {ind.ref_max}{unit}"
    return "—"


def _strip_disclaimer(text: str | None) -> str:
    if not text:
        return ""
    return re.sub(r"\n*⚠️[\s\S]*$", "", text.strip()).strip()


def build_lab_analysis_pdf(
    analysis: LabAnalysis,
    patient: Patient,
    doctor: User,
) -> bytes:
    font_path = _resolve_font()
    pdf = _LabPdf(font_path)
    pdf.alias_nb_pages()
    pdf.add_page()
    pdf.set_margins(14, 14, 14)

    doctor_name = (doctor.full_name or doctor.username).strip()
    test_title = analysis.test_type or "Лабораторный анализ"
    test_date = _format_date(analysis.test_date)

    x0 = pdf.l_margin
    w = pdf.w - pdf.l_margin - pdf.r_margin
    y0 = pdf.get_y()
    band_h = 30

    pdf.set_fill_color(*_ACCENT)
    pdf.rect(x0, y0, w, band_h, style="F")
    pdf.set_xy(x0 + 6, y0 + 6)
    pdf.set_font("DocFont", size=14)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(w - 12, 7, _CLINIC_NAME, new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(x0 + 6)
    pdf.set_font("DocFont", size=10)
    pdf.set_text_color(220, 228, 255)
    pdf.cell(w - 12, 6, f"Лабораторный анализ · {test_title}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(x0 + 6)
    pdf.cell(w - 12, 6, f"Дата анализа: {test_date} · Врач: {doctor_name}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_y(y0 + band_h + 8)
    pdf.set_text_color(*_TEXT_BODY)

    gender = _GENDER_RU.get(patient.gender, str(patient.gender))
    pdf.set_font("DocFont", size=9)
    pdf.set_text_color(*_TEXT_MUTED)
    pdf.cell(w, 5, "ПАЦИЕНТ", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)
    pdf.set_font("DocFont", size=10)
    pdf.set_text_color(*_TEXT_BODY)
    pdf.multi_cell(
        w,
        5.5,
        f"{patient.name} · {patient.age} лет · {gender}\n"
        f"Отклонений: {analysis.flagged_count or 0} из {analysis.total_count or 0}",
    )
    pdf.ln(4)

    indicators = sorted(
        analysis.indicators or [],
        key=lambda i: (0 if i.status in ("normal", "unknown") else 1, i.name),
    )

    col_w = [w * 0.34, w * 0.14, w * 0.18, w * 0.18, w * 0.16]
    pdf.set_fill_color(*_ACCENT_LIGHT)
    pdf.set_font("DocFont", size=8)
    pdf.set_text_color(*_ACCENT)
    headers = ["Показатель", "Значение", "Норма", "Статус", "Δ %"]
    for i, title in enumerate(headers):
        pdf.cell(col_w[i], 7, title, border=0, fill=True, align="L" if i == 0 else "C")
    pdf.ln()

    pdf.set_font("DocFont", size=9)
    pdf.set_text_color(*_TEXT_BODY)
    for ind in indicators:
        if pdf.get_y() > pdf.h - 24:
            pdf.add_page()
        name = ind.name
        if ind.name_en:
            name = f"{name} ({ind.name_en})"
        dev = ""
        if ind.deviation_pct is not None and ind.status not in ("normal", "unknown"):
            sign = "+" if ind.deviation_pct > 0 else ""
            dev = f"{sign}{ind.deviation_pct:.0f}%"
        row = [
            name[:42],
            f"{ind.value:g}{(' ' + ind.unit) if ind.unit else ''}",
            _format_ref(ind),
            _STATUS_RU.get(ind.status, ind.status),
            dev or "—",
        ]
        y_row = pdf.get_y()
        pdf.set_x(x0)
        for i, cell in enumerate(row):
            pdf.multi_cell(col_w[i], 5, cell, border=0, align="L" if i == 0 else "C")
            pdf.set_xy(x0 + sum(col_w[: i + 1]), y_row)
        pdf.ln(5.2)

    interpretation = _strip_disclaimer(analysis.ai_interpretation)
    if interpretation:
        pdf.ln(4)
        pdf.set_fill_color(*_ACCENT_LIGHT)
        pdf.set_draw_color(220, 224, 235)
        block_y = pdf.get_y()
        if block_y > pdf.h - 40:
            pdf.add_page()
            block_y = pdf.get_y()

        pdf.set_xy(x0 + 4, block_y + 4)
        pdf.set_font("DocFont", size=9)
        pdf.set_text_color(*_ACCENT)
        pdf.cell(w - 8, 5, "ИНТЕРПРЕТАЦИЯ GEMINI AI", new_x="LMARGIN", new_y="NEXT")
        pdf.set_x(x0 + 4)
        pdf.set_font("DocFont", size=9)
        pdf.set_text_color(*_TEXT_BODY)
        clean = re.sub(r"\*\*(.+?)\*\*", r"\1", interpretation)
        pdf.multi_cell(w - 8, 4.8, clean)

    pdf.ln(6)
    pdf.set_font("DocFont", size=8)
    pdf.set_text_color(*_TEXT_MUTED)
    pdf.multi_cell(
        w,
        4,
        "⚠️ Интерпретация носит вспомогательный характер. Клиническое решение принимает врач.",
    )
    pdf.ln(2)
    pdf.cell(
        0,
        4,
        f"Документ сформирован {datetime.now().strftime('%d.%m.%Y %H:%M')}",
    )

    buf = io.BytesIO()
    pdf.output(buf)
    return buf.getvalue()
