"""
Генерация обучающей выборки: расширенный список симптомов и диагнозов (амбулаторные картины).
Запуск: python scripts/gen_ml_data.py
После изменения удалите backend/ml_artifacts/*.joblib и meta.json или перезапустите API без артефактов.
"""
import json
import random
from pathlib import Path

random.seed(42)

symptom_keys = [
    "fever",
    "cough",
    "dry_cough",
    "runny_nose",
    "sore_throat",
    "hoarseness",
    "headache",
    "myalgia",
    "chills",
    "weakness",
    "shortness_breath",
    "chest_pain",
    "wheezing",
    "sputum",
    "hemoptysis",
    "nausea",
    "vomiting",
    "diarrhea",
    "constipation",
    "abdominal_pain",
    "heartburn",
    "rectal_bleeding",
    "photophobia",
    "dizziness",
    "back_pain",
    "sciatica_pain",
    "neck_stiffness",
    "frequent_urination",
    "pain_urination",
    "flank_pain",
    "polyuria",
    "urgency_urination",
    "rash",
    "itching",
    "vesicular_rash",
    "ear_pain",
    "sinus_pressure",
    "loss_smell",
    "joint_pain",
    "muscle_stiffness",
    "calf_pain_swelling",
    "ankle_edema",
    "palpitations",
    "cold_sweats",
    "jaundice",
    "confusion",
    "weight_loss",
    "night_sweats",
    "lymph_swelling",
    "cold_intolerance",
    "loss_appetite",
    "panic_feeling",
]

symptom_labels = {
    "fever": "лихорадка / температура",
    "cough": "кашель",
    "dry_cough": "сухой кашель",
    "runny_nose": "насморк",
    "sore_throat": "боль в горле",
    "hoarseness": "осиплость голоса",
    "headache": "головная боль",
    "myalgia": "мышечные боли",
    "chills": "озноб",
    "weakness": "слабость",
    "shortness_breath": "одышка",
    "chest_pain": "боль в груди",
    "wheezing": "свист при дыхании",
    "sputum": "мокрота",
    "hemoptysis": "кровохарканье",
    "nausea": "тошнота",
    "vomiting": "рвота",
    "diarrhea": "диарея",
    "constipation": "запор",
    "abdominal_pain": "боль в животе",
    "heartburn": "изжога",
    "rectal_bleeding": "кровь из прямой кишки",
    "photophobia": "светобоязнь",
    "dizziness": "головокружение",
    "back_pain": "боль в спине",
    "sciatica_pain": "прострел в ногу",
    "neck_stiffness": "ригидность затылочных мышц / скованность шеи",
    "frequent_urination": "учащённое мочеиспускание",
    "pain_urination": "боль при мочеиспускании",
    "flank_pain": "боль в пояснице",
    "polyuria": "обильное мочеиспускание",
    "urgency_urination": "императивные позывы",
    "rash": "сыпь",
    "itching": "зуд кожи",
    "vesicular_rash": "пузырьковая сыпь",
    "ear_pain": "боль в ухе",
    "sinus_pressure": "заложенность / давление в пазухах",
    "loss_smell": "снижение обоняния",
    "joint_pain": "боли в суставах",
    "muscle_stiffness": "скованность суставов по утрам",
    "calf_pain_swelling": "боль и отёк голени",
    "ankle_edema": "отёки на голенях",
    "palpitations": "перебои / сердцебиение",
    "cold_sweats": "холодный липкий пот",
    "jaundice": "желтушность кожи / склер",
    "confusion": "спутанность сознания",
    "weight_loss": "похудение",
    "night_sweats": "ночные поты",
    "lymph_swelling": "увеличение лимфоузлов",
    "cold_intolerance": "непереносимость холода",
    "loss_appetite": "снижение аппетита",
    "panic_feeling": "чувство страха / паники",
}

# Базовые наборы симптомов по диагнозу (упрощённые картины для обучения)
profiles: dict[str, list[str]] = {
    "ОРВИ": ["runny_nose", "sore_throat", "cough", "headache", "weakness"],
    "Грипп": ["fever", "chills", "myalgia", "headache", "weakness", "dry_cough"],
    "Острый фарингит": ["sore_throat", "dry_cough", "headache", "weakness", "lymph_swelling"],
    "Стрептококковая ангина": ["sore_throat", "fever", "headache", "weakness", "lymph_swelling"],
    "Острый ларингит": ["hoarseness", "sore_throat", "dry_cough", "weakness"],
    "Острый синусит": ["sinus_pressure", "headache", "runny_nose", "fever", "weakness"],
    "Острый средний отит": ["ear_pain", "fever", "weakness", "headache"],
    "Острый бронхит": ["cough", "sputum", "chest_pain", "fever", "weakness", "wheezing"],
    "Обострение ХОБЛ": ["cough", "sputum", "shortness_breath", "wheezing", "weakness", "chest_pain"],
    "Пневмония": ["fever", "cough", "sputum", "chest_pain", "shortness_breath", "weakness", "chills"],
    "Бронхиальная астма (приступ)": ["wheezing", "shortness_breath", "dry_cough", "chest_pain", "panic_feeling"],
    "COVID‑19 (лёгкое течение)": ["fever", "dry_cough", "weakness", "headache", "loss_smell", "myalgia"],
    "Инфекционный мононуклеоз": ["fever", "sore_throat", "lymph_swelling", "weakness", "headache", "loss_appetite"],
    "Острый гастрит": ["nausea", "abdominal_pain", "heartburn", "vomiting", "weakness"],
    "Острый гастроэнтерит": ["nausea", "vomiting", "diarrhea", "abdominal_pain", "fever", "weakness"],
    "Синдром раздражённого кишечника": ["abdominal_pain", "bloating_substitute", "diarrhea", "constipation"],
    "Язвенная болезнь желудка (обострение)": ["abdominal_pain", "heartburn", "nausea", "loss_appetite", "weakness"],
    "Острый панкреатит (типичная картина)": ["abdominal_pain", "nausea", "vomiting", "back_pain", "fever"],
    "Геморрой / анальная трещина с кровью": ["rectal_bleeding", "abdominal_pain", "pain_urination"],
    "Мигрень": ["headache", "photophobia", "nausea", "dizziness"],
    "Напряжённая головная боль": ["headache", "neck_stiffness", "weakness"],
    "Вестибулярный неврит": ["dizziness", "nausea", "vomiting", "weakness"],
    "Цервикалгия": ["neck_stiffness", "headache", "back_pain", "weakness"],
    "Люмбаго / радикулопатия": ["back_pain", "sciatica_pain", "muscle_stiffness", "weakness"],
    "Острый цистит": ["pain_urination", "urgency_urination", "frequent_urination", "lower_abd_substitute"],
    "Уретрит": ["pain_urination", "urgency_urination", "fever", "weakness"],
    "Пиелонефрит": ["fever", "flank_pain", "frequent_urination", "pain_urination", "nausea", "weakness"],
    "Мочекаменная болезнь (приступ)": ["flank_pain", "nausea", "vomiting", "urgency_urination", "hematuria_substitute"],
    "Стенокардия напряжения": ["chest_pain", "shortness_breath", "cold_sweats", "panic_feeling"],
    "Острая сердечная недостаточность": ["shortness_breath", "ankle_edema", "weakness", "cough", "palpitations"],
    "Пароксизмальная тахикардия": ["palpitations", "chest_pain", "dizziness", "panic_feeling", "weakness"],
    "Гипотиреоз": ["weakness", "cold_intolerance", "constipation", "dry_cough", "muscle_stiffness"],
    "Тиреотоксикоз": ["palpitations", "weight_loss", "weakness", "sweats_substitute", "panic_feeling"],
    "Декомпенсация сахарного диабета": ["polyuria", "frequent_urination", "weakness", "weight_loss", "nausea"],
    "Аллергический дерматит": ["rash", "itching", "weakness"],
    "Крапивница": ["rash", "itching", "panic_feeling", "weakness"],
    "Опоясывающий герпес": ["vesicular_rash", "pain_herpes_substitute", "fever", "weakness"],
    "Остеоартроз (обострение)": ["joint_pain", "muscle_stiffness", "weakness"],
    "Подагрический артрит (приступ)": ["joint_pain", "fever", "weakness", "night_sweats"],
    "Тромбоз глубоких вен (подозрительная картина)": ["calf_pain_swelling", "fever", "weakness", "chest_pain"],
    "Желтуха (гепатобилиарная картина)": ["jaundice", "abdominal_pain", "nausea", "weakness", "dark_urine_substitute"],
    "Острое нарушение мозгового кровообращения (тревожные симптомы)": ["confusion", "weakness", "headache", "neck_stiffness", "dizziness"],
    "Пневмоторакс (тревожная картина)": ["chest_pain", "shortness_breath", "dry_cough", "panic_feeling", "weakness"],
    "Туберкулёс лёгких (настороженная картина)": ["night_sweats", "weight_loss", "cough", "hemoptysis", "fever", "weakness"],
    "Злокачественное новообразование (неспецифическая картина)": ["weight_loss", "night_sweats", "weakness", "loss_appetite", "fever"],
    "Анемия тяжёлая": ["weakness", "dizziness", "palpitations", "cold_sweats", "shortness_breath"],
    "Почечная колика": ["flank_pain", "nausea", "vomiting", "urgency_urination", "restlessness_substitute"],
    "Пищевая аллергия": ["rash", "itching", "nausea", "abdominal_pain", "weakness"],
    "Пневмония атипичная": ["fever", "dry_cough", "headache", "weakness", "myalgia", "shortness_breath"],
}

# Заменители симптомов, которых нет в словаре — на ближайшие из symptom_keys
_ALIASES: dict[str, str] = {
    "bloating_substitute": "abdominal_pain",
    "lower_abd_substitute": "abdominal_pain",
    "hematuria_substitute": "pain_urination",
    "pain_herpes_substitute": "rash",
    "sweats_substitute": "night_sweats",
    "dark_urine_substitute": "jaundice",
    "restlessness_substitute": "panic_feeling",
}


def _normalize_profile(symptoms: list[str]) -> list[str]:
    out: list[str] = []
    for s in symptoms:
        key = _ALIASES.get(s, s)
        if key in symptom_keys and key not in out:
            out.append(key)
    return out


def _normalize_all_profiles() -> dict[str, list[str]]:
    return {disease: _normalize_profile(symptoms) for disease, symptoms in profiles.items()}


profiles = _normalize_all_profiles()

samples: list[dict] = []
per_disease = 140
for disease, base in profiles.items():
    base_set = set(base)
    if not base_set:
        base_set = {"weakness", "headache"}
    for _ in range(per_disease):
        sy = set(base_set)
        extras = [s for s in symptom_keys if s not in sy]
        random.shuffle(extras)
        for s in extras[: random.randint(0, 4)]:
            sy.add(s)
        for s in list(sy):
            if s in base_set and random.random() < 0.12:
                sy.discard(s)
        samples.append({"disease": disease, "symptoms": sorted(sy)})

root = Path(__file__).resolve().parents[1]
out = root / "ml_data" / "symptom_disease_samples.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(
    json.dumps(
        {"symptom_keys": symptom_keys, "symptom_labels": symptom_labels, "samples": samples},
        ensure_ascii=False,
        indent=2,
    ),
    encoding="utf-8",
)
print("wrote", out, "diseases", len(profiles), "samples", len(samples), "symptoms", len(symptom_keys))
