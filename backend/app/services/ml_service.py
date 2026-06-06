import json
from pathlib import Path

import joblib
import numpy as np
import shap
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

from app.config import settings
from app.database import ml_artifacts_dir


def _data_path() -> Path:
    return Path(__file__).resolve().parents[2] / "ml_data" / "symptom_disease_samples.json"


def _artifacts():
    base = ml_artifacts_dir()
    return base / "model.joblib", base / "meta.json"


class MLService:
    def __init__(self):
        self._model = None
        self._symptom_keys: list[str] = []
        self._disease_names: list[str] = []
        self._label_encoder: LabelEncoder | None = None
        self._symptom_labels: dict[str, str] = {}
        self._shap_explainer = None

    def load(self) -> None:
        model_path, meta_path = _artifacts()
        if not model_path.exists() or not meta_path.exists():
            train_and_save()
        bundle = joblib.load(model_path)
        self._model = bundle["model"]
        self._symptom_keys = bundle["symptom_keys"]
        self._label_encoder = bundle.get("label_encoder")
        if self._label_encoder is not None:
            self._disease_names = [str(x) for x in self._label_encoder.classes_]
        else:
            self._disease_names = [str(x) for x in self._model.classes_]
        with open(meta_path, encoding="utf-8") as f:
            meta = json.load(f)
        self._symptom_labels = meta.get("symptom_labels", {})

        # Создаём SHAP LinearExplainer
        n_features = len(self._symptom_keys)
        background = np.zeros((1, n_features))
        self._shap_explainer = shap.LinearExplainer(
            self._model,
            shap.maskers.Independent(background),
        )

    @property
    def symptom_keys(self) -> list[str]:
        return list(self._symptom_keys)

    def symptom_suggestions(self, q: str, limit: int = 20) -> list[dict]:
        q = q.strip().lower()
        out: list[dict] = []
        for k in self._symptom_keys:
            label = self._symptom_labels.get(k, k)
            hay = (k + " " + label).lower()
            if not q or q in hay:
                out.append({"key": k, "label": label})
            if len(out) >= limit:
                break
        return out[:limit]

    def disease_suggestions(self, q: str, limit: int = 20) -> list[dict]:
        if self._model is None:
            self.load()
        q = q.strip().lower()
        out: list[dict] = []
        for name in sorted(self._disease_names, key=str.lower):
            if not q or q in name.lower():
                out.append({"name": name})
            if len(out) >= limit:
                break
        return out[:limit]

    def symptom_labels_map(self) -> dict[str, str]:
        if self._model is None:
            self.load()
        out: dict[str, str] = {}
        for k in self._symptom_keys:
            out[k] = self._symptom_labels.get(k, k)
        for k, v in self._symptom_labels.items():
            if k not in out:
                out[k] = v
        return out

    def _vector(self, present: set[str]) -> np.ndarray:
        return np.array([[1.0 if s in present else 0.0 for s in self._symptom_keys]], dtype=np.float64)

    def predict(
        self,
        symptom_keys: list[str],
        clarifications: list[dict] | None,
    ) -> tuple[list[dict], bool, list[dict], float]:
        if self._model is None:
            self.load()

        # 1. Собираем вектор признаков
        present: set[str] = set(symptom_keys)
        if clarifications:
            for item in clarifications:
                key = item.get("symptom_key")
                if not key:
                    continue
                if item.get("present", False):
                    present.add(key)
                else:
                    present.discard(key)

        X = self._vector(present)

        # 2. Вероятности классов
        proba = self._model.predict_proba(X)[0]
        top_idx = np.argsort(-proba)[:3]
        max_p = float(proba[int(top_idx[0])])

        # 3. SHAP-значения для данного вектора
        shap_values_all = self._shap_explainer.shap_values(X)

        # Новый SHAP (>=0.40): ndarray формы (n_samples, n_features, n_classes)
        # Старый SHAP: список длиной n_classes, каждый элемент (n_samples, n_features)
        shap_is_3d = isinstance(shap_values_all, np.ndarray) and shap_values_all.ndim == 3

        # 4. Формируем топ-3 предсказания с SHAP-вкладами
        classes = np.asarray(self._model.classes_)
        le = self._label_encoder
        predictions: list[dict] = []

        for idx in top_idx:
            ci = int(idx)
            if le is not None:
                disease = str(le.inverse_transform(np.asarray([ci]))[0])
            else:
                disease = str(classes[ci])
            p = float(proba[ci])

            # Извлекаем вектор SHAP для класса ci
            if shap_is_3d:
                sv = shap_values_all[0, :, ci]   # (n_features,)
            else:
                sv = shap_values_all[ci][0]      # (n_features,)

            influences: list[dict] = []
            for j, sk in enumerate(self._symptom_keys):
                if sk not in present:
                    continue
                w = float(sv[j])
                influences.append(
                    {
                        "symptom_key": sk,
                        "symptom_label": self._symptom_labels.get(sk, sk),
                        "weight": round(w, 4),
                    }
                )
            influences.sort(key=lambda x: abs(x["weight"]), reverse=True)
            influences = influences[:8]
            predictions.append(
                {
                    "disease": disease,
                    "probability": round(p, 4),
                    "symptom_influences": influences,
                }
            )

        # 5. Уточняющие вопросы
        needs = max_p < settings.diagnosis_confidence_threshold
        questions: list[dict] = []
        if needs:
            questions = self._build_questions(present, top_idx[:2], proba)

        return predictions, needs, questions, max_p

    def _build_questions(
        self,
        present: set[str],
        top_class_idx: np.ndarray,
        proba: np.ndarray,
    ) -> list[dict]:
        if len(top_class_idx) < 2:
            return []
        i1, i2 = int(top_class_idx[0]), int(top_class_idx[1])
        c1 = self._model.coef_[i1]
        c2 = self._model.coef_[i2]
        diff = np.abs(c1 - c2)
        candidates: list[tuple[float, str]] = []
        for j, sk in enumerate(self._symptom_keys):
            if sk in present:
                continue
            candidates.append((float(diff[j]), sk))
        candidates.sort(reverse=True)
        out: list[dict] = []
        for _, sk in candidates[:5]:
            out.append(
                {
                    "symptom_key": sk,
                    "symptom_label": self._symptom_labels.get(sk, sk),
                    "hint": "Уточните наличие симптома для повышения точности диагноза.",
                }
            )
        return out[:3]


ml_service = MLService()


def train_and_save() -> None:
    path = _data_path()
    base = ml_artifacts_dir()
    base.mkdir(parents=True, exist_ok=True)
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    samples = raw["samples"]
    symptom_keys: list[str] = raw["symptom_keys"]
    symptom_labels: dict[str, str] = raw.get("symptom_labels", {})

    X_list: list[list[float]] = []
    y_list: list[str] = []
    for row in samples:
        vec = [1.0 if s in row["symptoms"] else 0.0 for s in symptom_keys]
        X_list.append(vec)
        y_list.append(row["disease"])

    X = np.array(X_list, dtype=np.float64)
    le = LabelEncoder()
    y = le.fit_transform(np.array(y_list))

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    model = LogisticRegression(max_iter=2000, solver="lbfgs", C=1.0)
    model.fit(X_train, y_train)

    disease_names = [str(c) for c in model.classes_]
    bundle = {
        "model": model,
        "symptom_keys": symptom_keys,
        "disease_names": disease_names,
        "label_encoder": le,
    }
    model_path, meta_path = _artifacts()
    joblib.dump(bundle, model_path)
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(
            {"symptom_labels": symptom_labels, "classes": [str(x) for x in disease_names]},
            f,
            ensure_ascii=False,
            indent=2,
        )