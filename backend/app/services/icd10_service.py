"""Справочник МКБ-10 для диагнозов системы."""

from __future__ import annotations

import json
from pathlib import Path

_MAPPING_PATH = Path(__file__).resolve().parents[2] / "ml_data" / "icd10_mapping.json"


class ICD10Service:
    def __init__(self) -> None:
        self._by_disease: dict[str, dict[str, str]] = {}
        self._loaded = False

    def load(self) -> None:
        if self._loaded:
            return
        with open(_MAPPING_PATH, encoding="utf-8") as f:
            raw = json.load(f)
        self._by_disease = {str(k): dict(v) for k, v in raw.items()}
        self._loaded = True

    def lookup(self, disease_name: str) -> dict[str, str] | None:
        self.load()
        name = (disease_name or "").strip()
        if not name:
            return None
        entry = self._by_disease.get(name)
        if entry:
            return entry
        low = name.lower()
        for key, val in self._by_disease.items():
            if key.lower() == low:
                return val
        return None

    def enrich_disease(self, disease_name: str) -> dict[str, str]:
        """Возвращает { name, icd10_code?, icd10_title_ru?, icd10_title_en? }."""
        out: dict[str, str] = {"name": disease_name}
        entry = self.lookup(disease_name)
        if entry:
            out["icd10_code"] = entry["code"]
            if entry.get("title_ru"):
                out["icd10_title_ru"] = entry["title_ru"]
            if entry.get("title_en"):
                out["icd10_title_en"] = entry["title_en"]
        return out

    def search(self, q: str, limit: int = 20) -> list[dict[str, str]]:
        self.load()
        q = q.strip().lower()
        out: list[dict[str, str]] = []
        for disease, entry in sorted(self._by_disease.items(), key=lambda x: x[0].lower()):
            hay = f"{disease} {entry.get('code', '')} {entry.get('title_ru', '')} {entry.get('title_en', '')}".lower()
            if not q or q in hay:
                out.append(self.enrich_disease(disease))
            if len(out) >= limit:
                break
        return out[:limit]

    def enrich_diagnoses_json(self, diagnoses: dict) -> dict:
        """Добавляет МКБ-10 к снимку консультации и к каждому prediction."""
        self.load()
        out = dict(diagnoses)

        preds = out.get("predictions")
        if isinstance(preds, list):
            new_preds = []
            for raw in preds:
                if isinstance(raw, dict):
                    item = dict(raw)
                    disease = item.get("disease")
                    if isinstance(disease, str):
                        icd = self.lookup(disease)
                        if icd:
                            item["icd10_code"] = icd["code"]
                            if icd.get("title_ru"):
                                item["icd10_title_ru"] = icd["title_ru"]
                            if icd.get("title_en"):
                                item["icd10_title_en"] = icd["title_en"]
                    new_preds.append(item)
                else:
                    new_preds.append(raw)
            out["predictions"] = new_preds

        primary = None
        if isinstance(out.get("doctor_diagnosis"), str) and out["doctor_diagnosis"].strip():
            primary = out["doctor_diagnosis"].strip()
        elif isinstance(preds, list) and preds and isinstance(preds[0], dict):
            d = preds[0].get("disease")
            if isinstance(d, str):
                primary = d

        if primary:
            icd = self.lookup(primary)
            if icd:
                out["icd10_code"] = icd["code"]
                if icd.get("title_ru"):
                    out["icd10_title_ru"] = icd["title_ru"]
                if icd.get("title_en"):
                    out["icd10_title_en"] = icd["title_en"]

        return out


icd10_service = ICD10Service()
