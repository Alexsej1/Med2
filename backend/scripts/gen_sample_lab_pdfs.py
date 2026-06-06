"""Генерация примеров PDF-бланков лабораторных анализов для тестирования загрузки."""

from __future__ import annotations

import io
from datetime import date
from pathlib import Path

from fpdf import FPDF

from app.services.consultation_pdf import _resolve_font


def _make_lab_pdf(
    *,
    title: str,
    lab_name: str,
    patient_name: str,
    test_date: date,
    rows: list[tuple[str, str, str, str]],
    out_path: Path,
) -> None:
    font_path = _resolve_font()
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=16)
    pdf.add_font("DocFont", "", str(font_path))
    pdf.add_page()
    pdf.set_margins(16, 16, 16)

    pdf.set_font("DocFont", size=16)
    pdf.cell(0, 10, lab_name, new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("DocFont", size=12)
    pdf.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("DocFont", size=10)
    pdf.cell(0, 6, f"Пациент: {patient_name}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(
        0,
        6,
        f"Дата: {test_date.strftime('%d.%m.%Y')}",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(6)

    col_w = [70, 35, 45, 35]
    pdf.set_font("DocFont", size=9)
    for i, head in enumerate(["Показатель", "Результат", "Референс", "Ед."]):
        pdf.cell(col_w[i], 8, head, border=1)
    pdf.ln()

    for name, value, ref, unit in rows:
        pdf.cell(col_w[0], 8, name, border=1)
        pdf.cell(col_w[1], 8, value, border=1)
        pdf.cell(col_w[2], 8, ref, border=1)
        pdf.cell(col_w[3], 8, unit, border=1)
        pdf.ln()

    out_path.parent.mkdir(parents=True, exist_ok=True)
    buf = io.BytesIO()
    pdf.output(buf)
    out_path.write_bytes(buf.getvalue())


def main() -> None:
    root = Path(__file__).resolve().parents[1] / "samples" / "lab"
    patient = "Иванов Иван Иванович"

    _make_lab_pdf(
        title="Общий анализ крови (ОАК)",
        lab_name="Инвитро — медицинская лаборатория",
        patient_name=patient,
        test_date=date(2026, 3, 12),
        rows=[
            ("Гемоглобин", "118", "130–160", "г/л"),
            ("Эритроциты", "4.1", "4.0–5.5", "×10¹²/л"),
            ("Лейкоциты", "8.9", "4.0–9.0", "×10⁹/л"),
            ("Тромбоциты", "245", "180–320", "×10⁹/л"),
            ("СОЭ", "18", "2–15", "мм/ч"),
            ("Глюкоза", "5.4", "3.9–6.1", "ммоль/л"),
        ],
        out_path=root / "sample-oak-blood.pdf",
    )

    _make_lab_pdf(
        title="Биохимический анализ крови",
        lab_name="KDL — клинико-диагностическая лаборатория",
        patient_name=patient,
        test_date=date(2026, 4, 2),
        rows=[
            ("АЛТ", "52", "0–41", "Ед/л"),
            ("АСТ", "38", "0–37", "Ед/л"),
            ("Кreatinin", "98", "62–106", "мкмоль/л"),
            ("Мочевина", "6.8", "2.5–8.3", "ммоль/л"),
            ("Общий белок", "72", "64–83", "г/л"),
            ("Билирубин общий", "14", "3–21", "мкмоль/л"),
            ("Холестерин", "6.2", "3.0–5.2", "ммоль/л"),
        ],
        out_path=root / "sample-biochemistry.pdf",
    )

    _make_lab_pdf(
        title="Гормоны щитовидной железы",
        lab_name="Гемотест",
        patient_name=patient,
        test_date=date(2026, 4, 15),
        rows=[
            ("ТТГ", "0.18", "0.4–4.0", "мЕд/л"),
            ("Свободный T4", "18.2", "9.0–19.0", "пмоль/л"),
            ("Свободный T3", "5.8", "2.6–5.7", "пмоль/л"),
            ("Аnti-TPO", "112", "0–34", "МЕ/мл"),
        ],
        out_path=root / "sample-thyroid-hormones.pdf",
    )

    print(f"Создано 3 PDF в {root}")


if __name__ == "__main__":
    main()
