"""
Удаляет все консультации и пациентов, затем заполняет БД реалистичными демо-данными.
Пользователи не удаляются. Создаются/обновляются врачи doctor, doctor2, doctor3 (пароль doctor123)
и админ admin (admin123). Пациенты распределяются между врачами.

Запуск из каталога backend:
    python scripts/reset_and_seed.py

Настройка объёма (внизу файла): PATIENTS_PER_DOCTOR, VISITS_MIN, VISITS_MAX.
"""
from __future__ import annotations

import random
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy.orm import Session  # noqa: E402

from app.auth_utils import hash_password  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models import Consultation, Gender, Patient, User, UserRole  # noqa: E402

# --- объём демо-данных (меняйте по желанию) ---
PATIENTS_PER_DOCTOR = 4  # итого = 3 врача × это число
VISITS_MIN = 2
VISITS_MAX = 5
RNG_SEED = 40

SURNAMES = (
    "Иванов", "Петров", "Сидоров", "Козлов", "Новиков", "Морозов", "Волков", "Соколов",
    "Лебедев", "Кузнецов", "Попов", "Васильев", "Смирнов", "Михайлов", "Фёдоров", "Андреев",
    "Николаев", "Орлов", "Зайцев", "Семёнов", "Егоров", "Павлов", "Голубев", "Виноградов",
    "Богданов", "Ковалёв", "Белый", "Тарасов", "Комаров", "Жуков", "Баранов", "Куликов",
)
def feminize_surname(surname: str) -> str:
    """Возвращает женскую форму фамилии по стандартным правилам русского языка."""
    # прилагательные: -ский/-цкий → -ская/-цкая
    if surname.endswith(("ский", "цкий", "жский")):
        return surname[:-2] + "ая"
    # прилагательные на -ый/-ой/-ий (Белый, Голубой)
    if surname.endswith(("ый", "ой", "ий")):
        return surname[:-2] + "ая"
    # -ев/-ёв/-ов → -ева/-ёва/-ова
    if surname.endswith(("ев", "ёв", "ов")):
        return surname + "а"
    # -ин/-ын → -ина/-ына
    if surname.endswith(("ин", "ын")):
        return surname + "а"
    # несклоняемые — оставляем как есть
    return surname
MALE_NAMES = (
    "Александр", "Дмитрий", "Максим", "Сергей", "Андрей", "Алексей", "Иван", "Михаил",
    "Николай", "Павел", "Роман", "Виктор", "Игорь", "Константин", "Олег", "Владимир",
)
FEMALE_NAMES = (
    "Анна", "Мария", "Елена", "Ольга", "Наталья", "Татьяна", "Ирина", "Екатерина",
    "Светлана", "Юлия", "Виктория", "Полина", "Дарья", "Алина", "Ксения", "Валерия",
)
PATRONYMICS_M = ("Иванович", "Петрович", "Сергеевич", "Андреевич", "Николаевич", "Алексеевич")
PATRONYMICS_F = ("Ивановна", "Петровна", "Сергеевна", "Андреевна", "Николаевна", "Алексеевна")
CITIES = ("Минск", "Гродно", "Брест", "Витебск", "Могилёв", "Гомель", "Борисов", "Барановичи")
_TRANSLIT_MAP = {
    'а': 'a',  'б': 'b',  'в': 'v',  'г': 'g',  'д': 'd',
    'е': 'e',  'ё': 'yo', 'ж': 'zh', 'з': 'z',  'и': 'i',
    'й': 'y',  'к': 'k',  'л': 'l',  'м': 'm',  'н': 'n',
    'о': 'o',  'п': 'p',  'р': 'r',  'с': 's',  'т': 't',
    'у': 'u',  'ф': 'f',  'х': 'kh', 'ц': 'ts', 'ч': 'ch',
    'ш': 'sh', 'щ': 'sch','ъ': '',   'ы': 'y',  'ь': '',
    'э': 'e',  'ю': 'yu', 'я': 'ya',
}

def translit(s: str) -> str:
    return ''.join(_TRANSLIT_MAP.get(ch, ch) for ch in s.lower()).replace(' ', '')

SYMPTOM_SETS: list[list[str]] = [
    ["fever", "cough", "runny_nose", "headache"],
    ["sore_throat", "hoarseness", "dry_cough"],
    ["headache", "weakness", "dizziness"],
    ["nausea", "diarrhea", "weakness"],
    ["chest_pain", "shortness_breath", "cough"],
    ["runny_nose", "sinus_pressure", "itching"],
    ["weakness", "myalgia", "chills"],
    ["dry_cough", "chest_pain", "weakness"],
    ["sore_throat", "fever", "headache"],
    ["shortness_breath", "wheezing", "cough"],
]
DIAGNOSES: list[list[tuple[str, float]]] = [
    [("ОРВИ", 0.55), ("Острый риносинусит", 0.2)],
    [("Острый фарингит", 0.42), ("ОРВИ", 0.28)],
    [("Артериальная гипертензия (обострение)", 0.35), ("Тревожное расстройство", 0.12)],
    [("Острая кишечная инфекция", 0.38), ("Пищевая токсикоинфекция", 0.22)],
    [("Бронхиальная астма, обострение лёгкой степени", 0.4), ("ОРВИ", 0.18)],
    [("Аллергический ринит", 0.5), ("ОРВИ", 0.2)],
    [("Астенический синдром", 0.25), ("Анемия (не исключена)", 0.15)],
    [("Трахеит", 0.32), ("ОРВИ", 0.26)],
    [("Острый тонзиллит", 0.36), ("ОРВИ", 0.3)],
    [("Ишемическая болезнь сердца (исключить)", 0.2), ("Межрёберная невралгия", 0.17)],
]
NOTES_SAMPLES = (
    "Симптоматическое лечение, контроль через неделю.",
    "Рекомендованы обильное питьё и отдых.",
    "Назначены анализы, повторный визит по результатам.",
    "Динамика положительная, продолжить схему.",
    "Контроль АД, вести дневник измерений.",
    "Исключить аллерген, антигистаминные при необходимости.",
    "Регидратация, щадящая диета 3–5 дней.",
    "ЭКГ без острых изменений, наблюдение амбулаторно.",
)


def ensure_doctor(db: Session, username: str, password: str, full_name: str) -> User:
    u = db.query(User).filter(User.username == username).first()
    if u:
        if u.role != UserRole.doctor:
            raise SystemExit(f"Пользователь {username} существует, но не врач")
        return u
    u = User(
        username=username,
        hashed_password=hash_password(password),
        role=UserRole.doctor,
        full_name=full_name,
    )
    db.add(u)
    db.flush()
    return u


def age_from_birth(bd: date) -> int:
    today = date.today()
    a = today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))
    return max(0, min(a, 130))


def diag(
    items: list[tuple[str, float]],
    needs: bool = False,
    questions: list | None = None,
) -> dict:
    max_p = max((p for _, p in items), default=0.0)
    return {
        "predictions": [
            {"disease": d, "probability": p, "symptom_influences": []}
            for d, p in items
        ],
        "needs_clarification": needs,
        "clarifying_questions": questions or [],
        "max_probability": max_p,
    }


def _rand_birth(rng: random.Random, gender: Gender) -> date:
    year = rng.randint(1948, 2006)
    month = rng.randint(1, 12)
    day = rng.randint(1, 28)
    return date(year, month, day)


def _rand_phone(rng: random.Random) -> str:
    return f"+375{rng.randint(25, 44)}{rng.randint(1000000, 9999999)}"


def _make_patient_spec(doctor_idx: int, rng: random.Random, used_names: set[str]) -> dict:
    gender = Gender.female if rng.random() < 0.52 else Gender.male
    surname = rng.choice(SURNAMES)
    if gender == Gender.male:
        first = rng.choice(MALE_NAMES)
        patronymic = rng.choice(PATRONYMICS_M)
    else:
        first = rng.choice(FEMALE_NAMES)
        patronymic = rng.choice(PATRONYMICS_F)
    display_surname = feminize_surname(surname) if gender == Gender.female else surname
    name = f"{display_surname} {first} {patronymic}"
    while name in used_names:
        surname = rng.choice(SURNAMES)
        display_surname = feminize_surname(surname) if gender == Gender.female else surname
        name = f"{display_surname} {first} {patronymic}"
    used_names.add(name)

    birth = _rand_birth(rng, gender)
    city = rng.choice(CITIES)
    house = rng.randint(1, 120)
    has_policy = rng.random() > 0.15
    has_allergy = rng.random() < 0.25
    has_chronic = rng.random() < 0.35

    return {
        "doctor_idx": doctor_idx,
        "name": name,
        "birth": birth,
        "gender": gender,
        "phone": _rand_phone(rng),
        "email": f"{translit(first)}.{translit(surname)}@mail.example" if rng.random() > 0.2 else None,
        "address": f"г. {city}, ул. Примерная, д. {house}, кв. {rng.randint(1, 180)}",
        "policy": f"РБ {rng.randint(10**12, 10**14 - 1)}" if has_policy else None,
        "emerg_name": f"{rng.choice(SURNAMES)} {rng.choice(FEMALE_NAMES + MALE_NAMES)}",
        "emerg_phone": _rand_phone(rng),
        "allergies": rng.choice(("Пенициллин", "Пыльца", "Аспирин", "Йод")) if has_allergy else None,
        "chronic": rng.choice(
            (
                "Артериальная гипертензия I степени",
                "Сахарный диабет 2 типа",
                "Хронический гастрит",
                "Бронхиальная астма",
            )
        )
        if has_chronic
        else None,
        "notes": rng.choice(
            (
                "Предпочитает утренние приёмы.",
                "Контроль хронического заболевания.",
                None,
                "Требуется напоминание о повторном визите.",
            )
        ),
    }


def _handcrafted_patients() -> list[dict]:
    """Несколько детально прописанных карт (по 2 на врача)."""
    return [
        {
            "doctor_idx": 0,
            "name": "Ковалёва Анна Сергеевна",
            "birth": date(1986, 4, 12),
            "gender": Gender.female,
            "phone": "+375291234567",
            "email": "a.kovaleva@mail.example",
            "address": "г. Минск, ул. Ленина, д. 15, кв. 42",
            "policy": "РБ 12345678901234",
            "emerg_name": "Ковалёв Сергей Петрович",
            "emerg_phone": "+375297654321",
            "allergies": "Пенициллин",
            "chronic": "Хронический гастрит в ремиссии",
            "notes": "Предпочитает утренние приёмы.",
        },
        {
            "doctor_idx": 0,
            "name": "Михайлов Дмитрий Викторович",
            "birth": date(1972, 11, 3),
            "gender": Gender.male,
            "phone": "+375447112233",
            "email": "d.mikhailov@mail.example",
            "address": "г. Гродно, пр-т Космонавтов, д. 8",
            "policy": "РБ 98765432109876",
            "emerg_name": "Михайлова Ольга",
            "emerg_phone": "+375447998877",
            "allergies": None,
            "chronic": "Артериальная гипертензия I степени",
            "notes": "Контроль АД на каждом визите.",
        },
        {
            "doctor_idx": 1,
            "name": "Савицкий Павел Андреевич",
            "birth": date(2001, 2, 28),
            "gender": Gender.male,
            "phone": "+375259887766",
            "email": "p.savitsky@student.example",
            "address": "г. Витебск, мкр. Южный, д. 4, кв. 18",
            "policy": None,
            "emerg_name": "Савицкая Марина",
            "emerg_phone": "+375259443322",
            "allergies": None,
            "chronic": None,
            "notes": "Студент, жалобы на утомляемость.",
        },
        {
            "doctor_idx": 1,
            "name": "Лукашевич Мария Павловна",
            "birth": date(1960, 9, 5),
            "gender": Gender.female,
            "phone": "+375291778899",
            "email": "m.lukashevich@mail.example",
            "address": "г. Минск, ул. Кальварийская, д. 25, кв. 7",
            "policy": "РБ 11122233344455",
            "emerg_name": "Лукашевич Павел",
            "emerg_phone": "+375291009988",
            "allergies": "Йодсодержащие препараты",
            "chronic": "Сахарный диабет 2 типа",
            "notes": "На диете, контроль гликемии.",
        },
        {
            "doctor_idx": 2,
            "name": "Жук Алексей Николаевич",
            "birth": date(1988, 1, 19),
            "gender": Gender.male,
            "phone": "+375447334455",
            "email": "a.zhuk@work.example",
            "address": "г. Могилёв, ул. Первомайская, д. 33",
            "policy": "РБ 77788899900011",
            "emerg_name": "Жук Николай",
            "emerg_phone": "+375447001122",
            "allergies": None,
            "chronic": None,
            "notes": "Работа связана с вождением.",
        },
        {
            "doctor_idx": 2,
            "name": "Петрова Елена Игоревна",
            "birth": date(1995, 7, 22),
            "gender": Gender.female,
            "phone": "+375336554422",
            "email": None,
            "address": "г. Брест, ул. Советская, д. 112, кв. 5",
            "policy": "РБ 55501122334455",
            "emerg_name": "Петров Игорь",
            "emerg_phone": "+375336112233",
            "allergies": "Пыльца берёзы",
            "chronic": None,
            "notes": None,
        },
    ]


def _build_patient_list(rng: random.Random) -> list[dict]:
    specs = _handcrafted_patients()
    used_names = {s["name"] for s in specs}
    per_doctor_count: dict[int, int] = {0: 0, 1: 0, 2: 0}
    for s in specs:
        per_doctor_count[s["doctor_idx"]] += 1

    for doctor_idx in range(3):
        need = PATIENTS_PER_DOCTOR - per_doctor_count[doctor_idx]
        for _ in range(max(0, need)):
            specs.append(_make_patient_spec(doctor_idx, rng, used_names))
    return specs


def _generate_visits(
    patient_count: int,
    now: datetime,
    rng: random.Random,
) -> list[tuple[int, datetime, datetime | None, list[str], dict, str, bool | None]]:
    visits: list[tuple[int, datetime, datetime | None, list[str], dict, str, bool | None]] = []
    for p_idx in range(patient_count):
        n = rng.randint(VISITS_MIN, VISITS_MAX)
        # визиты от старых к новым
        day_offsets = sorted(rng.sample(range(3, 400), k=n))
        for i, days_ago in enumerate(day_offsets):
            hour = rng.randint(8, 17)
            minute = rng.choice((0, 15, 30, 45))
            visit_at = (now - timedelta(days=days_ago, hours=24 - hour, minutes=60 - minute)).replace(
                second=0, microsecond=0
            )
            sym_idx = rng.randint(0, len(SYMPTOM_SETS) - 1)
            feedback = rng.choice((True, False, None))
            next_visit: datetime | None = None
            # у ~35% последнего визита пациента — запланирован повтор
            if i == n - 1 and rng.random() < 0.35:
                future_days = rng.randint(3, 45)
                next_visit = (now + timedelta(days=future_days)).replace(
                    hour=rng.randint(9, 16),
                    minute=rng.choice((0, 30)),
                    second=0,
                    microsecond=0,
                )
            visits.append(
                (
                    p_idx,
                    visit_at,
                    next_visit,
                    SYMPTOM_SETS[sym_idx],
                    diag(DIAGNOSES[sym_idx % len(DIAGNOSES)]),
                    rng.choice(NOTES_SAMPLES),
                    feedback,
                )
            )
    return visits


def clear_and_seed() -> None:
    rng = random.Random(RNG_SEED)
    db: Session = SessionLocal()
    try:
        n_con = db.query(Consultation).delete(synchronize_session=False)
        n_pat = db.query(Patient).delete(synchronize_session=False)
        db.commit()
        print(f"Удалено консультаций: {n_con}, пациентов: {n_pat}")

        doc_ivanov = ensure_doctor(db, "doctor", "doctor123", "Доктор Иванов")
        doc_petrova = ensure_doctor(db, "doctor2", "doctor123", "Доктор Петрова")
        doc_sidorov = ensure_doctor(db, "doctor3", "doctor123", "Доктор Сидоров")
        doctors_by_idx = [doc_ivanov, doc_petrova, doc_sidorov]

        patients_spec = _build_patient_list(rng)
        patients: list[Patient] = []
        for s in patients_spec:
            doc = doctors_by_idx[s["doctor_idx"]]
            p = Patient(
                doctor_id=doc.id,
                name=s["name"],
                age=age_from_birth(s["birth"]),
                gender=s["gender"],
                birth_date=s["birth"],
                phone=s["phone"],
                email=s["email"],
                address=s["address"],
                policy_number=s["policy"],
                emergency_contact_name=s["emerg_name"],
                emergency_contact_phone=s["emerg_phone"],
                allergies=s["allergies"],
                chronic_conditions=s["chronic"],
                patient_notes=s["notes"],
            )
            db.add(p)
            patients.append(p)
        db.flush()

        now = datetime.utcnow().replace(microsecond=0)
        visits = _generate_visits(len(patients), now, rng)

        for p_idx, visit_at, next_d, sym_keys, diagnoses, notes, feedback in visits:
            pat = patients[p_idx]
            c = Consultation(
                patient_id=pat.id,
                doctor_id=pat.doctor_id,
                visit_at=visit_at,
                next_visit_date=next_d,
                notes=notes,
                symptoms_json=sym_keys,
                clarifications_json=None,
                diagnoses_json=diagnoses,
                diagnosis_feedback=feedback,
                created_at=visit_at,
            )
            db.add(c)

        db.commit()

        by_doc: dict[str, tuple[int, int]] = {}
        for doc in doctors_by_idx:
            pc = sum(1 for p in patients if p.doctor_id == doc.id)
            cc = db.query(Consultation).filter(Consultation.doctor_id == doc.id).count()
            by_doc[doc.username] = (pc, cc)

        print(f"Добавлено пациентов: {len(patients)}, консультаций: {len(visits)}.")
        for username, (pc, cc) in by_doc.items():
            print(f"  {username}: пациентов {pc}, консультаций {cc}")
    finally:
        db.close()


if __name__ == "__main__":
    clear_and_seed()
