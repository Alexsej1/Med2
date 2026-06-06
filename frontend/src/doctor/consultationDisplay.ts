import type { DiagnoseResponse } from "../types";

export function humanizeSymptomKey(key: string): string {
  if (!key) return "";
  return key.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

/** Подпись симптома: словарь из API (RU), иначе «человеческий» ключ. */
export function labelForSymptomKey(
  key: string,
  labels?: Record<string, string> | null,
): string {
  if (!key) return "";
  const fromMap = labels?.[key];
  if (fromMap) return fromMap;
  return humanizeSymptomKey(key);
}

/** Снимок диагностики из сохранённого JSON консультации (без полей бэкенда вроде saved_at). */
export function parseDiagnosisSnapshot(
  raw: Record<string, unknown> | null | undefined,
): DiagnoseResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const preds = (raw as Partial<DiagnoseResponse>).predictions;
  if (!Array.isArray(preds) || preds.length === 0) return null;
  const maxP = (raw as Partial<DiagnoseResponse>).max_probability;
  return {
    predictions: preds as DiagnoseResponse["predictions"],
    needs_clarification: Boolean(
      (raw as Partial<DiagnoseResponse>).needs_clarification,
    ),
    clarifying_questions: Array.isArray(
      (raw as Partial<DiagnoseResponse>).clarifying_questions,
    )
      ? ((raw as DiagnoseResponse).clarifying_questions ?? [])
      : [],
    max_probability:
      typeof maxP === "number" ? maxP : Number(preds[0]?.probability ?? 0),
  };
}

export function symptomLabelFromSnapshot(
  key: string,
  diag: DiagnoseResponse | null,
  labels?: Record<string, string> | null,
): string {
  if (diag) {
    const q = diag.clarifying_questions?.find((x) => x.symptom_key === key);
    if (q?.symptom_label) return q.symptom_label;
    for (const pr of diag.predictions) {
      const inf = pr.symptom_influences?.find((si) => si.symptom_key === key);
      if (inf?.symptom_label) return inf.symptom_label;
    }
  }
  return labelForSymptomKey(key, labels);
}

export function clarificationRows(
  raw: unknown,
  labels?: Record<string, string> | null,
): { key: string; label: string; present: boolean }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (x): x is Record<string, unknown> => Boolean(x) && typeof x === "object",
    )
    .map((x) => ({
      key: String(x.symptom_key ?? ""),
      label: labelForSymptomKey(String(x.symptom_key ?? ""), labels),
      present: Boolean(x.present),
    }))
    .filter((x) => x.key);
}

export function doctorDiagnosisFromSnapshot(
  d: Record<string, unknown> | null | undefined,
): string | null {
  if (!d) return null;
  const raw = d.doctor_diagnosis;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return null;
}

export type Icd10Info = { code: string; titleRu?: string; titleEn?: string };

export function icd10FromSnapshot(
  d: Record<string, unknown> | null | undefined,
): Icd10Info | null {
  if (!d) return null;
  const code = d.icd10_code;
  if (typeof code !== "string" || !code.trim()) return null;
  const titleRu = d.icd10_title_ru;
  const titleEn = d.icd10_title_en;
  return {
    code: code.trim(),
    titleRu:
      typeof titleRu === "string" && titleRu.trim()
        ? titleRu.trim()
        : undefined,
    titleEn:
      typeof titleEn === "string" && titleEn.trim()
        ? titleEn.trim()
        : undefined,
  };
}

export function formatIcd10Line(
  icd: Icd10Info | null,
  preferEn = true,
): string | null {
  if (!icd) return null;
  const title = preferEn
    ? (icd.titleEn ?? icd.titleRu)
    : (icd.titleRu ?? icd.titleEn);
  return title ? `МКБ-10: ${icd.code} — ${title}` : `МКБ-10: ${icd.code}`;
}

export function topDiagnosisLine(
  d: Record<string, unknown> | null | undefined,
): string {
  const doctor = doctorDiagnosisFromSnapshot(d);
  const icd = formatIcd10Line(icd10FromSnapshot(d));
  if (doctor) {
    return icd ? `${doctor} (${icd.replace("МКБ-10: ", "")})` : doctor;
  }
  if (!d) return "—";
  const preds = (d as Partial<DiagnoseResponse>).predictions;
  if (!Array.isArray(preds) || preds.length === 0) return "—";
  const first = preds[0] as {
    disease?: string;
    probability?: number;
    icd10_code?: string;
    icd10_title_en?: string;
  };
  if (!first?.disease) return "—";
  const p = first.probability;
  const pct = typeof p === "number" ? ` (${Math.round(p * 100)}%)` : "";
  const code = first.icd10_code ? ` [${first.icd10_code}]` : "";
  return `${first.disease}${code}${pct}`;
}

export function symptomsShort(
  keys: string[] | null,
  max = 5,
  labels?: Record<string, string> | null,
): string {
  if (!keys || keys.length === 0) return "—";
  const parts = keys.slice(0, max).map((k) => labelForSymptomKey(k, labels));
  const s = parts.join(", ");
  return keys.length > max ? `${s}…` : s;
}

export function notesSnippet(notes: string | null, maxLen = 80): string {
  if (!notes) return "—";
  const t = notes.replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}
