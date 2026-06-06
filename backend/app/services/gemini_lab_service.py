"""Двухшаговый анализ лабораторных бланков через Gemini (извлечение + интерпретация)."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.config import settings

_logger = logging.getLogger(__name__)

_DISCLAIMER = (
    "⚠️ Интерпретация носит вспомогательный характер. Клиническое решение принимает врач."
)

_MODEL_FALLBACKS = (
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-2.5-flash",
    "gemini-1.5-flash-8b",
)

_EXTRACT_PROMPT = """Ты медицинская система извлечения данных.
Из предоставленного документа (лабораторный анализ) извлеки ВСЕ показатели.

Верни ТОЛЬКО валидный JSON без каких-либо пояснений, без markdown, без ```json блоков.
Формат строго:
{
  "test_type": "название анализа (ОАК / биохимия / гормоны / моча / другое)",
  "test_date": "дата анализа в формате YYYY-MM-DD или null если не указана",
  "lab_name": "название лаборатории или null",
  "indicators": [
    {
      "name": "русское название показателя",
      "name_en": "английское название или аббревиатура",
      "value": числовое значение (только число),
      "unit": "единица измерения",
      "ref_min": минимум референса (только число или null),
      "ref_max": максимум референса (только число или null),
      "status": "normal" | "low" | "high" | "critical_low" | "critical_high"
    }
  ]
}

Если показатель не числовой (например, качественный) — пропусти его.
Если референсные значения не указаны — поставь null и status "unknown".
Сравни value с ref_min/ref_max и выставь status."""


def friendly_gemini_error(exc: BaseException) -> str:
    msg = str(exc).strip()
    low = msg.lower()
    if "api key" in low or "apikey" in low or "permission" in low:
        return "Неверный или отсутствующий ключ Gemini. Проверьте TSAR_GEMINI_API_KEY в backend/.env"
    if "quota" in low or "429" in low or "resource exhausted" in low:
        return "Превышена квота Gemini API. Подождите или проверьте лимиты в Google AI Studio"
    if "404" in msg or ("not found" in low and "model" in low):
        return (
            f"Модель «{settings.gemini_model}» недоступна. "
            "Укажите в .env: TSAR_GEMINI_MODEL=gemini-2.0-flash"
        )
    if "blocked" in low or "safety" in low:
        return "Gemini заблокировал ответ (фильтр безопасности). Попробуйте другой файл"
    if msg:
        return f"Ошибка Gemini: {msg[:280]}"
    return "Не удалось обработать документ через Gemini"


def _parse_json_response(text: str) -> dict[str, Any]:
    raw = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw, re.IGNORECASE)
    if fence:
        raw = fence.group(1).strip()
    start = raw.find("{")
    end = raw.rfind("}")
    if start >= 0 and end > start:
        raw = raw[start : end + 1]
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError("Gemini вернул некорректный JSON. Попробуйте загрузить файл ещё раз") from exc
    if not isinstance(data, dict):
        raise ValueError("Ожидался JSON-объект от Gemini")
    return data


def _response_text(response: Any) -> str:
    try:
        text = response.text
        if text and str(text).strip():
            return str(text).strip()
    except (ValueError, AttributeError):
        pass

    candidates = getattr(response, "candidates", None) or []
    chunks: list[str] = []
    for cand in candidates:
        content = getattr(cand, "content", None)
        if not content:
            continue
        for part in getattr(content, "parts", []) or []:
            t = getattr(part, "text", None)
            if t:
                chunks.append(str(t))
    if chunks:
        return "\n".join(chunks).strip()

    feedback = getattr(response, "prompt_feedback", None)
    block = getattr(feedback, "block_reason", None) if feedback else None
    if block:
        raise ValueError(f"Запрос к Gemini заблокирован: {block}")

    raise ValueError("Пустой ответ от Gemini (нет текста в ответе)")


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip().replace(",", ".")
    m = re.search(r"-?\d+(?:\.\d+)?", s)
    if not m:
        return None
    try:
        return float(m.group())
    except ValueError:
        return None


def _compute_status(value: float | None, ref_min: float | None, ref_max: float | None) -> str:
    if value is None:
        return "unknown"
    if ref_min is None and ref_max is None:
        return "unknown"
    if ref_min is not None and value < ref_min:
        if ref_min > 0 and value < ref_min * 0.7:
            return "critical_low"
        return "low"
    if ref_max is not None and value > ref_max:
        if ref_max > 0 and value > ref_max * 1.3:
            return "critical_high"
        return "high"
    return "normal"


def _deviation_pct(value: float | None, ref_min: float | None, ref_max: float | None) -> float | None:
    if value is None or ref_min is None or ref_max is None:
        return None
    mid = (ref_min + ref_max) / 2
    if mid == 0:
        return None
    return round(((value - mid) / mid) * 100, 1)


def normalize_extracted(data: dict[str, Any]) -> dict[str, Any]:
    indicators_raw = data.get("indicators")
    if not isinstance(indicators_raw, list):
        indicators_raw = []

    indicators: list[dict[str, Any]] = []
    for item in indicators_raw:
        if not isinstance(item, dict):
            continue
        value = _to_float(item.get("value"))
        if value is None:
            continue
        ref_min = _to_float(item.get("ref_min"))
        ref_max = _to_float(item.get("ref_max"))
        status = str(item.get("status", "")).lower()
        if status not in ("normal", "low", "high", "critical_low", "critical_high", "unknown"):
            status = _compute_status(value, ref_min, ref_max)
        elif status == "unknown":
            status = _compute_status(value, ref_min, ref_max)

        indicators.append(
            {
                "name": str(item.get("name", "")).strip() or "—",
                "name_en": (str(item.get("name_en")).strip() if item.get("name_en") else None),
                "value": value,
                "unit": (str(item.get("unit")).strip() if item.get("unit") else None),
                "ref_min": ref_min,
                "ref_max": ref_max,
                "status": status,
                "deviation_pct": _deviation_pct(value, ref_min, ref_max),
            }
        )

    if not indicators:
        raise ValueError(
            "Не удалось извлечь числовые показатели из документа. "
            "Убедитесь, что загружен читаемый PDF или фото бланка"
        )

    flagged = [i for i in indicators if i["status"] not in ("normal", "unknown")]

    return {
        "test_type": (str(data.get("test_type")).strip() if data.get("test_type") else None)
        or "Лабораторный анализ",
        "test_date": (str(data.get("test_date")).strip() if data.get("test_date") else None),
        "lab_name": (str(data.get("lab_name")).strip() if data.get("lab_name") else None),
        "indicators": indicators,
        "flagged_count": len(flagged),
        "total_count": len(indicators),
    }


def _model_names() -> list[str]:
    names: list[str] = []
    if settings.gemini_model.strip():
        names.append(settings.gemini_model.strip())
    for m in _MODEL_FALLBACKS:
        if m not in names:
            names.append(m)
    return names


def _get_genai():
    if not settings.gemini_api_key.strip():
        raise RuntimeError(
            "Не настроен ключ Gemini API. Создайте файл backend/.env и укажите:\n"
            "TSAR_GEMINI_API_KEY=ваш_ключ\n"
            "Получить ключ: https://aistudio.google.com/apikey"
        )
    try:
        import google.generativeai as genai  # pyright: ignore[reportMissingImports]
    except ImportError as exc:
        raise RuntimeError(
            "Пакет google-generativeai не установлен. Выполните: pip install google-generativeai"
        ) from exc

    genai.configure(api_key=settings.gemini_api_key.strip())
    return genai


def _generate_content(
    parts: list[Any],
    *,
    json_mode: bool = False,
    max_output_tokens: int | None = None,
) -> Any:
    genai = _get_genai()
    last_error: Exception | None = None

    for model_name in _model_names():
        model = genai.GenerativeModel(model_name)
        try:
            kwargs: dict[str, Any] = {}
            gen_config: dict[str, Any] = {}
            if json_mode:
                gen_config["response_mime_type"] = "application/json"
            if max_output_tokens is not None:
                gen_config["max_output_tokens"] = max_output_tokens
            if gen_config:
                kwargs["generation_config"] = gen_config
            return model.generate_content(parts, **kwargs)
        except Exception as exc:
            last_error = exc
            err = str(exc).lower()
            if "404" in str(exc) or "not found" in err or "invalid model" in err:
                _logger.warning("Gemini model %s unavailable, trying next", model_name)
                continue
            raise

    if last_error:
        raise last_error
    raise RuntimeError("Нет доступных моделей Gemini")


def extract_indicators_from_file(file_bytes: bytes, mime_type: str) -> dict[str, Any]:
    parts = [_EXTRACT_PROMPT, {"mime_type": mime_type, "data": file_bytes}]

    try:
        response = _generate_content(parts, json_mode=True)
    except Exception as exc:
        err = str(exc).lower()
        if "response_mime_type" in err or "json" in err or "400" in str(exc):
            _logger.info("Gemini JSON mode unsupported, fallback to text")
            response = _generate_content(parts, json_mode=False)
        else:
            raise

    text = _response_text(response)
    return normalize_extracted(_parse_json_response(text))


def _clean_interpretation(text: str) -> str:
    cleaned = text.strip()
    cleaned = re.sub(r"```[\s\S]*?```", "", cleaned)
    cleaned = re.sub(r"\*\*(.+?)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"\1", cleaned)
    cleaned = re.sub(r"^#+\s*", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def interpret_results(extracted: dict[str, Any], patient: dict[str, Any]) -> str:
    flagged = [i for i in extracted.get("indicators", []) if i.get("status") not in ("normal", "unknown")]

    gender_ru = "мужской" if patient.get("gender") == "male" else (
        "женский" if patient.get("gender") == "female" else "не указан"
    )

    prompt = f"""Ты ИИ-ассистент для врача. Помоги обратить внимание на отклонения и дай практические рекомендации.
Не ставь диагнозы. Все рекомендации — как подсказка врачу, не пациенту.

ПАЦИЕНТ: {patient.get("age", "?")} лет, {gender_ru}.
Диагноз/состояния: {patient.get("diagnosis") or "не указан"}.
Препараты: {patient.get("medications") or "не указаны"}.
Аллергии: {patient.get("allergies") or "не указаны"}.

АНАЛИЗ: {extracted.get("test_type")}, {extracted.get("test_date") or "дата не указана"}.
Лаборатория: {extracted.get("lab_name") or "не указана"}.

ОТКЛОНЕНИЯ:
{json.dumps(flagged, ensure_ascii=False, indent=2) if flagged else "нет"}

Напиши подробную интерпретацию на русском языке.
Без markdown: не используй **, #, списки с «-».

Формат — заголовки ЗАГЛАВНЫМИ БУКВАМИ на отдельной строке:

ОБЩАЯ КАРТИНА
2-3 предложения: что в целом показывает анализ, насколько серьёзны отклонения.

ОТКЛОНЕНИЯ
По одной строке на каждый отклонённый показатель через «—»: название, направление, возможная клиническая причина.
Если отклонений нет — «Значимых отклонений не выявлено».

НА ЧТО ОБРАТИТЬ ВНИМАНИЕ
2-4 пункта: симптомы или состояния, которые стоит уточнить у пациента, дополнительные анализы если нужны.

ПИТАНИЕ И ОБРАЗ ЖИЗНИ
Конкретные продукты или привычки, которые помогут при данных отклонениях. Например: при низком железе — красное мясо, гречка; при высоком холестерине — ограничить жирное, больше клетчатки. 2-4 пункта.

ВОЗМОЖНАЯ КОРРЕКЦИЯ
Группы препаратов или добавок, которые врач может рассмотреть (без конкретных торговых названий и доз — это решает врач). Например: препараты железа, витамин D, омега-3. Если отклонений нет — пропусти этот раздел.

НОРМА
Одно предложение о показателях, которые в порядке.
"""
    response = _generate_content([prompt], json_mode=False, max_output_tokens=3000)
    text = _clean_interpretation(_response_text(response))
    if _DISCLAIMER not in text:
        text = f"{text}\n\n{_DISCLAIMER}"
    return text


def analyze_lab_document(file_bytes: bytes, mime_type: str, patient: dict[str, Any]) -> tuple[dict[str, Any], str]:
    extracted = extract_indicators_from_file(file_bytes, mime_type)
    interpretation = interpret_results(extracted, patient)
    return extracted, interpretation


def patient_context_from_model(patient: Any, latest_diagnosis: str | None = None) -> dict[str, Any]:
    gender_val = patient.gender.value if hasattr(patient.gender, "value") else str(patient.gender)
    diagnosis = patient.chronic_conditions or latest_diagnosis or None
    return {
        "age": patient.age,
        "gender": gender_val,
        "diagnosis": diagnosis,
        "medications": patient.patient_notes,
        "allergies": patient.allergies,
    }
