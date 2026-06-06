"""
Оценка качества обученной модели — метрики и матрица ошибок.
Запуск из папки backend:
    python scripts/evaluate_model.py
"""

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
)
from sklearn.model_selection import train_test_split

# пути
ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "ml_data" / "symptom_disease_samples.json"
MODEL_PATH = ROOT / "ml_artifacts" / "model.joblib"

# проверка что файлы существуют
if not DATA_PATH.exists():
    print(f"Не найден датасет: {DATA_PATH}")
    print("Сначала запусти: python scripts/gen_ml_data.py")
    sys.exit(1)

if not MODEL_PATH.exists():
    print(f"Не найдена модель: {MODEL_PATH}")
    print("Сначала запусти сервер один раз чтобы модель обучилась")
    sys.exit(1)

# загрузка датасета
print("Загрузка датасета...")
with open(DATA_PATH, encoding="utf-8") as f:
    raw = json.load(f)

samples = raw["samples"]
symptom_keys = raw["symptom_keys"]

X_list, y_list = [], []
for row in samples:
    vec = [1.0 if s in row["symptoms"] else 0.0 for s in symptom_keys]
    X_list.append(vec)
    y_list.append(row["disease"])

X = np.array(X_list, dtype=np.float64)
y = np.array(y_list)

# то же разбиение что при обучении (random_state=42)
_, X_test, _, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# загрузка модели
print("Загрузка модели...")
bundle = joblib.load(MODEL_PATH)
model = bundle["model"]
le = bundle["label_encoder"]

# предсказание
y_test_enc = le.transform(y_test)
y_pred_enc = model.predict(X_test)
y_pred = le.inverse_transform(y_pred_enc)

# метрики
print("\n" + "=" * 60)
print("МЕТРИКИ МОДЕЛИ")
print("=" * 60)
acc = accuracy_score(y_test, y_pred)
print(f"Accuracy:  {acc:.4f}")

report = classification_report(
    y_test, y_pred,
    digits=3,
    zero_division=0
)
print("\nClassification report (по классам):")
print(report)

# macro-средние отдельно для удобства копирования в диплом
from sklearn.metrics import precision_score, recall_score, f1_score
p = precision_score(y_test, y_pred, average="macro", zero_division=0)
r = recall_score(y_test, y_pred, average="macro", zero_division=0)
f1 = f1_score(y_test, y_pred, average="macro", zero_division=0)
print("=" * 60)
print("ИТОГОВАЯ СТРОКА ДЛЯ ТАБЛИЦЫ В ДИПЛОМЕ:")
print(f"  Accuracy:          {acc:.4f}")
print(f"  Precision (macro): {p:.4f}")
print(f"  Recall (macro):    {r:.4f}")
print(f"  F1 (macro):        {f1:.4f}")
print("=" * 60)

# матрица ошибок
print("\nПостроение матрицы ошибок...")
cm = confusion_matrix(y_test, y_pred, labels=le.classes_)

plt.figure(figsize=(20, 18))
sns.heatmap(
    cm,
    annot=True,
    fmt="d",
    xticklabels=le.classes_,
    yticklabels=le.classes_,
    cmap="Blues",
    linewidths=0.3,
)
plt.title("Матрица ошибок модели", fontsize=14, pad=16)
plt.ylabel("Истинный класс", fontsize=11)
plt.xlabel("Предсказанный класс", fontsize=11)
plt.xticks(rotation=45, ha="right", fontsize=7)
plt.yticks(rotation=0, fontsize=7)
plt.tight_layout()

out_path = ROOT / "confusion_matrix.png"
plt.savefig(out_path, dpi=150)
print(f"Матрица сохранена: {out_path}")