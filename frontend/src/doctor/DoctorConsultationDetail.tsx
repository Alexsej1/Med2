import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { api, fetchConsultationPdf } from "../api";
import type { Consultation, Patient } from "../types";
import { useSymptomLabels } from "../SymptomLabelsContext";
import {
  clarificationRows,
  doctorDiagnosisFromSnapshot,
  formatIcd10Line,
  icd10FromSnapshot,
  parseDiagnosisSnapshot,
  symptomLabelFromSnapshot,
} from "./consultationDisplay";
import { formatDateTimeRu } from "./dateUtils";

const genderRu: Record<string, string> = {
  male: "Мужской",
  female: "Женский",
  other: "Другой",
};

export function DoctorConsultationDetail() {
  const { consultationId } = useParams();
  const cid = Number(consultationId);
  const { token } = useAuth();
  const symptomLabels = useSymptomLabels();
  const [c, setC] = useState<Consultation | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    if (!token || !cid) return;
    let cancelled = false;
    (async () => {
      setErr(null);
      try {
        const cons = await api.consultation(token, cid);
        if (cancelled) return;
        setC(cons);
        const p = await api.patient(token, cons.patient_id);
        if (!cancelled) setPatient(p);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Ошибка");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, cid]);

  const diag = useMemo(
    () => parseDiagnosisSnapshot(c?.diagnoses_json ?? null),
    [c?.diagnoses_json],
  );

  const doctorDx = useMemo(
    () => doctorDiagnosisFromSnapshot(c?.diagnoses_json ?? null),
    [c?.diagnoses_json],
  );

  const icd10Line = useMemo(
    () => formatIcd10Line(icd10FromSnapshot(c?.diagnoses_json ?? null)),
    [c?.diagnoses_json],
  );

  const clarRows = useMemo(() => {
    if (!c) return [];
    const base = clarificationRows(c.clarifications_json, symptomLabels);
    return base.map((row) => ({
      ...row,
      label: symptomLabelFromSnapshot(row.key, diag, symptomLabels),
    }));
  }, [c, diag, symptomLabels]);

  if (err) return <p className="error page-loading">{err}</p>;
  if (!c || !patient) return <p className="muted page-loading">Загрузка…</p>;

  const visitDate = new Date(c.visit_at);

  async function downloadPdf() {
    if (!token || !cid) return;
    setPdfBusy(true);
    setErr(null);
    try {
      const blob = await fetchConsultationPdf(token, cid);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `consultation-${cid}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось скачать PDF");
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="page-stack">
      {/* Breadcrumb */}
      <nav className="breadcrumb">
        <Link to="/doctor/history">История</Link>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M4 2l4 4-4 4"
            stroke="#9095a8"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <Link to={`/doctor/patients/${patient.id}`}>{patient.name}</Link>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M4 2l4 4-4 4"
            stroke="#9095a8"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span style={{ color: "#0a0e1a", fontWeight: 600 }}>
          Консультация от{" "}
          {visitDate.toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "short",
          })}
        </span>
      </nav>

      {/* Hero */}
      <div className="ppd-hero">
        <div className="ppd-hero__left">
          <div className="ppd-hero__avatar">
            {patient.name
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0])
              .join("")
              .toUpperCase()}
          </div>
          <div className="ppd-hero__info">
            <h1 className="ppd-hero__name">{patient.name}</h1>
            <div className="ppd-hero__meta">
              <span>{patient.age} лет</span>
              <span className="ppd-hero__dot" />
              <span>{genderRu[patient.gender] ?? patient.gender}</span>
              <span className="ppd-hero__dot" />
              <span>
                {visitDate.toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <span className="ppd-hero__dot" />
              <span style={{ fontWeight: 600, color: "#4E67EB" }}>
                {visitDate.toLocaleTimeString("ru-RU", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        </div>
        <div className="ppd-hero__right">
          <button
            type="button"
            className="btn secondary"
            onClick={downloadPdf}
            disabled={pdfBusy}
            style={{ marginRight: 8 }}
          >
            {pdfBusy ? "Формирование…" : "Скачать PDF"}
          </button>
          {c.diagnosis_feedback === true && (
            <span className="ppd-feedback ppd-feedback--ok">
              ИИ-диагноз подтверждён
            </span>
          )}
          {c.diagnosis_feedback === false && (
            <span className="ppd-feedback ppd-feedback--err">
              ИИ-диагноз не подтверждён
            </span>
          )}
          {c.next_visit_date && (
            <span
              className="pts-badge"
              style={{ fontSize: "0.85rem", padding: "6px 14px" }}
            >
              Повторный визит: {formatDateTimeRu(c.next_visit_date)}
            </span>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div className="cnd-grid">
        {/* Left: symptoms + clarifications + notes */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Symptoms */}
          <div className="card card--elevated">
            <h2 className="ppd-section-title">Симптомы</h2>
            {c.symptoms_json && c.symptoms_json.length > 0 ? (
              <div className="cns-chips" style={{ margin: 0 }}>
                {c.symptoms_json.map((key) => (
                  <span key={key} className="cns-chip">
                    {symptomLabelFromSnapshot(key, diag, symptomLabels)}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, color: "#9095a8", fontSize: "0.9rem" }}>
                Не указаны
              </p>
            )}
          </div>

          {/* Clarifications */}
          {clarRows.length > 0 && (
            <div className="card card--elevated">
              <h2 className="ppd-section-title">Уточнения</h2>
              <div className="cnd-clar-list">
                {clarRows.map((row) => (
                  <div key={row.key} className="cnd-clar-row">
                    <span className="cnd-clar-label">{row.label}</span>
                    <span
                      className={`cnd-clar-val ${row.present ? "cnd-clar-val--yes" : "cnd-clar-val--no"}`}
                    >
                      {row.present ? "Да" : "Нет"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {c.notes && (
            <div className="card card--elevated">
              <h2 className="ppd-section-title">Заметки врача</h2>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.9rem",
                  color: "#5a6078",
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                }}
              >
                {c.notes}
              </p>
            </div>
          )}
        </div>

        {/* Right: diagnosis */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {doctorDx && (
            <div className="card card--elevated">
              <h2 className="ppd-section-title">Диагноз</h2>
              <p
                style={{
                  margin: 0,
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  color: "#0a0e1a",
                }}
              >
                {doctorDx}
              </p>
              {icd10Line && (
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: "0.88rem",
                    color: "#5a6078",
                  }}
                >
                  {icd10Line}
                </p>
              )}
            </div>
          )}

          {diag ? (
            <div className="card card--elevated">
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  marginBottom: 16,
                  gap: 12,
                }}
              >
                <h2 className="ppd-section-title" style={{ margin: 0 }}>
                  ИИ-диагностика
                </h2>
                <span
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: "#4E67EB",
                    background: "#eef1fd",
                    padding: "4px 10px",
                    borderRadius: 8,
                  }}
                >
                  {(diag.max_probability * 100).toFixed(1)}% уверенность
                </span>
              </div>

              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {diag.predictions.map((p, i) => (
                  <div key={`${p.disease}-${i}`} className="cnd-pred">
                    <div className="cnd-pred__top">
                      <span className="cnd-pred__name">{p.disease}</span>
                      <span
                        className={`cnd-pred__pct ${i === 0 ? "cnd-pred__pct--top" : ""}`}
                      >
                        {(p.probability * 100).toFixed(1)}%
                      </span>
                    </div>
                    {p.icd10_code && (
                      <p className="cnd-pred__icd">
                        МКБ-10: {p.icd10_code}
                        {p.icd10_title_en ? ` — ${p.icd10_title_en}` : ""}
                      </p>
                    )}
                    <div className="cnd-pred__bar">
                      <div
                        className="cnd-pred__bar-fill"
                        style={{
                          width: `${Math.min(100, p.probability * 100)}%`,
                          opacity: i === 0 ? 1 : 0.5,
                        }}
                      />
                    </div>
                    {p.symptom_influences.length > 0 && i === 0 && (
                      <div className="cnd-pred__influences">
                        {p.symptom_influences.slice(0, 5).map((si) => (
                          <span
                            key={si.symptom_key}
                            className="cnd-pred__inf-tag"
                          >
                            {si.symptom_label}
                            <span style={{ color: "#9095a8", marginLeft: 3 }}>
                              {si.weight > 0 ? "+" : ""}
                              {si.weight.toFixed(2)}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              className="card card--elevated"
              style={{ textAlign: "center", padding: "32px 24px" }}
            >
              <p style={{ margin: 0, color: "#9095a8", fontSize: "0.9rem" }}>
                Данные диагностики недоступны
              </p>
            </div>
          )}

          {/* Visit info card */}
          <div className="card card--elevated">
            <h2 className="ppd-section-title">Информация о визите</h2>
            <dl className="ppd-dl">
              <div className="ppd-dl__row">
                <dt>Дата приёма</dt>
                <dd>{visitDate.toLocaleString("ru-RU")}</dd>
              </div>
              <div className="ppd-dl__row">
                <dt>Следующий визит</dt>
                <dd>
                  {c.next_visit_date ? (
                    <span className="pts-badge">
                      {formatDateTimeRu(c.next_visit_date)}
                    </span>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="ppd-dl__row">
                <dt>Оценка ИИ</dt>
                <dd>
                  {c.diagnosis_feedback === true && (
                    <span className="ppd-feedback ppd-feedback--ok">Верно</span>
                  )}
                  {c.diagnosis_feedback === false && (
                    <span className="ppd-feedback ppd-feedback--err">
                      Неверно
                    </span>
                  )}
                  {c.diagnosis_feedback === null && "—"}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
