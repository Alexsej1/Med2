"""Лёгкие миграции для существующих БД (create_all не добавляет колонки в уже созданные таблицы)."""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def _patient_column_sql(dialect: str, name: str, col_type: str) -> str:
    if dialect == "mysql":
        return f"ALTER TABLE patients ADD COLUMN {name} {col_type} NULL"
    return f"ALTER TABLE patients ADD COLUMN {name} {col_type}"


def run_patient_extended_columns(engine: Engine) -> None:
    insp = inspect(engine)
    if "patients" not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns("patients")}
    dialect = engine.dialect.name

    # Типы совместимы с SQLite и MySQL
    planned: list[tuple[str, str]] = [
        ("phone", "VARCHAR(64)"),
        ("email", "VARCHAR(256)"),
        ("birth_date", "DATE"),
        ("address", "TEXT"),
        ("policy_number", "VARCHAR(128)"),
        ("emergency_contact_name", "VARCHAR(256)"),
        ("emergency_contact_phone", "VARCHAR(64)"),
        ("allergies", "TEXT"),
        ("chronic_conditions", "TEXT"),
        ("patient_notes", "TEXT"),
    ]

    with engine.begin() as conn:
        for col, typ in planned:
            if col in existing:
                continue
            sql = _patient_column_sql(dialect, col, typ)
            conn.execute(text(sql))


def run_next_visit_datetime(engine: Engine) -> None:
    """SQLite хранит даты гибко; для MySQL приводим next_visit_date к DATETIME."""
    if engine.dialect.name != "mysql":
        return
    insp = inspect(engine)
    if "consultations" not in insp.get_table_names():
        return
    cols = {c["name"]: c for c in insp.get_columns("consultations")}
    col = cols.get("next_visit_date")
    if not col:
        return
    type_name = str(col.get("type", "")).upper()
    if "DATETIME" in type_name:
        return
    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE consultations MODIFY COLUMN next_visit_date DATETIME NULL"
            )
        )


def run_lab_analyses_columns(engine: Engine) -> None:
    insp = inspect(engine)
    if "lab_analyses" not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns("lab_analyses")}
    dialect = engine.dialect.name

    planned: list[tuple[str, str]] = [
        ("test_type", "VARCHAR(100)"),
        ("test_date", "DATE"),
        ("extracted_json", "TEXT" if dialect == "sqlite" else "JSON"),
        ("ai_interpretation", "TEXT"),
        ("flagged_count", "INTEGER"),
        ("total_count", "INTEGER"),
        ("status", "VARCHAR(20)"),
    ]

    with engine.begin() as conn:
        for col, typ in planned:
            if col in existing:
                continue
            if dialect == "mysql":
                sql = f"ALTER TABLE lab_analyses ADD COLUMN {col} {typ} NULL"
            else:
                sql = f"ALTER TABLE lab_analyses ADD COLUMN {col} {typ}"
            conn.execute(text(sql))

        if "interpretation_json" in existing:
            col_info = next(c for c in insp.get_columns("lab_analyses") if c["name"] == "interpretation_json")
            if not col_info.get("nullable", True) and dialect == "sqlite":
                pass
