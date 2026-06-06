import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { api } from "../api";
import type { DiseaseSuggestion, DiagnoseResponse, Patient } from "../types";
import { datetimeLocalToApiIso } from "./dateUtils";

type Clar = { symptom_key: string; present: boolean };

export function DoctorConsultation() {
  const { id } = useParams();
  const pid = Number(id);
  const { token } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [symptomInput, setSymptomInput] = useState("");
  const [symptomFocused, setSymptomFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<
    { key: string; label: string }[]
  >([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const symptomBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [diag, setDiag] = useState<DiagnoseResponse | null>(null);
  const [clarAnswers, setClarAnswers] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [nextVisit, setNextVisit] = useState("");
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [doctorDiagnosis, setDoctorDiagnosis] = useState<string | null>(null);
  const [diseaseInput, setDiseaseInput] = useState("");
  const [diseaseSuggestions, setDiseaseSuggestions] = useState<
    DiseaseSuggestion[]
  >([]);
  const [doctorIcd10, setDoctorIcd10] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);

  useEffect(() => {
    if (!token || !pid) return;
    void api
      .patient(token, pid)
      .then(setPatient)
      .catch((e) => setErr(String(e)));
  }, [token, pid]);

  const fetchSuggest = useCallback(async () => {
    if (!token || !symptomFocused) return;
    setSuggestionsLoading(true);
    try {
      const s = await api.symptoms(token, symptomInput.trim());
      setSuggestions(s.filter((item) => !selected.includes(item.key)));
    } catch {
      setSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
    }
  }, [token, symptomInput, symptomFocused, selected]);

  useEffect(() => {
    if (!symptomFocused) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      void fetchSuggest();
    }, 200);
    return () => clearTimeout(t);
  }, [fetchSuggest, symptomFocused]);

  useEffect(() => {
    return () => {
      if (symptomBlurTimer.current) clearTimeout(symptomBlurTimer.current);
    };
  }, []);

  const fetchDiseaseSuggest = useCallback(async () => {
    if (!token || feedback !== false) return;
    const s = await api.diseases(token, diseaseInput);
    setDiseaseSuggestions(s);
  }, [token, diseaseInput, feedback]);

  useEffect(() => {
    if (feedback !== false) {
      setDiseaseSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      void fetchDiseaseSuggest();
    }, 200);
    return () => clearTimeout(t);
  }, [fetchDiseaseSuggest, feedback]);

  function openSymptomField() {
    if (symptomBlurTimer.current) {
      clearTimeout(symptomBlurTimer.current);
      symptomBlurTimer.current = null;
    }
    setSymptomFocused(true);
  }

  function closeSymptomField() {
    symptomBlurTimer.current = setTimeout(() => {
      setSymptomFocused(false);
      setSuggestions([]);
    }, 180);
  }

  function addSymptom(key: string, label: string) {
    setLabels((m) => ({ ...m, [key]: label }));
    setSelected((s) => (s.includes(key) ? s : [...s, key]));
    setSymptomInput("");
  }

  function removeSymptom(key: string) {
    setSelected((s) => s.filter((x) => x !== key));
    setLabels((m) => {
      const n = { ...m };
      delete n[key];
      return n;
    });
  }

  async function runDiagnose() {
    if (!token) return;
    setErr(null);
    setBusy(true);
    try {
      const clarifications: Clar[] = Object.entries(clarAnswers).map(
        ([symptom_key, present]) => ({ symptom_key, present }),
      );
      const res = await api.diagnose(token, {
        symptom_keys: selected,
        clarifications,
      });
      setDiag(res);
      setFeedback(null);
      setDoctorDiagnosis(null);
      setDoctorIcd10(null);
      setDiseaseInput("");
      setDiseaseSuggestions([]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка диагностики");
    } finally {
      setBusy(false);
    }
  }

  function selectDoctorDiagnosis(item: DiseaseSuggestion) {
    setDoctorDiagnosis(item.name);
    setDoctorIcd10(item.icd10_code ?? null);
    setDiseaseInput("");
    setDiseaseSuggestions([]);
  }

  function setFeedbackChoice(value: boolean) {
    setFeedback(value);
    if (value) {
      setDoctorDiagnosis(null);
      setDoctorIcd10(null);
      setDiseaseInput("");
      setDiseaseSuggestions([]);
    }
  }

  const clarificationsPayload = useMemo(() => {
    return Object.entries(clarAnswers).map(([symptom_key, present]) => ({
      symptom_key,
      present,
    }));
  }, [clarAnswers]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!token || feedback === null) {
      setErr("Отметьте, верен ли диагноз");
      return;
    }
    if (!diag) {
      setErr("Сначала выполните диагностику");
      return;
    }
    if (feedback === false && !doctorDiagnosis) {
      setErr("Выберите диагноз из списка подсказок");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const diagnosesPayload: Record<string, unknown> = {
        ...diag,
        saved_at: new Date().toISOString(),
      };
      if (feedback === false && doctorDiagnosis) {
        diagnosesPayload.doctor_diagnosis = doctorDiagnosis;
      }
      const c = await api.createConsultation(token, {
        patient_id: pid,
        next_visit_date: datetimeLocalToApiIso(nextVisit),
        notes: notes || null,
        symptom_keys: selected,
        clarifications: clarificationsPayload.length
          ? clarificationsPayload
          : null,
        diagnoses: diagnosesPayload,
        diagnosis_feedback: feedback,
      });
      setSavedId(c.id);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  }

  if (!patient) return <p className="muted page-loading">Загрузка…</p>;

  return (
    <div className="page-stack">
      {/* Breadcrumb */}
      <nav className="breadcrumb">
        <Link to="/doctor/patients">Пациенты</Link>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M4 2l4 4-4 4"
            stroke="#9095a8"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <Link to={`/doctor/patients/${pid}`}>{patient.name}</Link>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M4 2l4 4-4 4"
            stroke="#9095a8"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span style={{ color: "#0a0e1a", fontWeight: 600 }}>Консультация</span>
      </nav>

      {/* Page header */}
      <div>
        <h1 className="page-title" style={{ marginBottom: 4 }}>
          Новая консультация
        </h1>
        <p style={{ margin: 0, fontSize: "0.9rem", color: "#9095a8" }}>
          Пациент:{" "}
          <span style={{ color: "#0a0e1a", fontWeight: 600 }}>
            {patient.name}
          </span>
          {" · "}
          {patient.age} лет
        </p>
      </div>

      {/* ── ALL SECTIONS ON ONE PAGE ── */}
      <form onSubmit={onSave} className="page-stack">
        {/* 1. SYMPTOMS */}
        <div className="card card--elevated cns-card">
          <h2 className="cns-card__title">Симптомы</h2>
          <p className="cns-card__sub">
            Нажмите на поле ниже — откроется список; можно выбрать из него или
            начать вводить для поиска
          </p>

          <div
            className={`cns-search-wrap${symptomFocused ? " cns-search-wrap--open" : ""}`}
          >
            <svg
              className="pts-search-icon"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
            >
              <circle
                cx="6.5"
                cy="6.5"
                r="5"
                stroke="#9095a8"
                strokeWidth="1.5"
              />
              <path
                d="M10.5 10.5L14 14"
                stroke="#9095a8"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <input
              className="pts-search-input"
              value={symptomInput}
              onChange={(e) => setSymptomInput(e.target.value)}
              onFocus={openSymptomField}
              onBlur={closeSymptomField}
              placeholder="Кликните и выберите симптом или введите для поиска…"
              autoComplete="off"
              autoFocus={false}
              aria-expanded={symptomFocused && suggestions.length > 0}
              aria-haspopup="listbox"
            />
            {symptomFocused && suggestionsLoading && (
              <span className="pts-search-spinner" aria-hidden="true" />
            )}
            {symptomFocused && !suggestionsLoading && suggestions.length > 0 && (
              <ul className="cns-suggest" role="listbox">
                {suggestions.map((s) => (
                  <li
                    key={s.key}
                    role="option"
                    tabIndex={0}
                    className="cns-suggest__item"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addSymptom(s.key, s.label)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && addSymptom(s.key, s.label)
                    }
                  >
                    {s.label}
                  </li>
                ))}
              </ul>
            )}
            {symptomFocused &&
              !suggestionsLoading &&
              suggestions.length === 0 &&
              symptomInput.trim() && (
                <p className="cns-suggest-empty">Ничего не найдено</p>
              )}
          </div>

          {selected.length > 0 && (
            <div className="cns-chips">
              {selected.map((k) => (
                <span key={k} className="cns-chip">
                  {labels[k] ?? k}
                  <button
                    type="button"
                    className="cns-chip__remove"
                    onClick={() => removeSymptom(k)}
                    aria-label="Удалить"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M1 1l8 8M9 1L1 9"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              className="pts-add-btn"
              disabled={busy || selected.length === 0}
              onClick={() => void runDiagnose()}
            >
              {busy ? "Анализ…" : "Поставить диагноз"}
              {!busy && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M3 7h8M8 4l3 3-3 3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* 2. DIAGNOSIS (shows after first diagnose) */}
        {diag && (
          <>
            <div className="card card--elevated cns-card">
              <div className="cns-diag-header">
                <div>
                  <h2 className="cns-card__title">Результат ИИ-диагностики</h2>
                  <p className="cns-card__sub">
                    Максимальная уверенность:&nbsp;
                    <strong style={{ color: "#4E67EB" }}>
                      {(diag.max_probability * 100).toFixed(1)}%
                    </strong>
                  </p>
                </div>
              </div>

              <div className="cns-diag-grid">
                {diag.predictions.map((p, i) => (
                  <div
                    key={`${p.disease}-${i}`}
                    className={`cns-diag-card ${i === 0 ? "cns-diag-card--top" : ""}`}
                  >
                    {i === 0 && (
                      <div className="cns-diag-card__badge">
                        Наиболее вероятно
                      </div>
                    )}
                    <div className="cns-diag-card__name">{p.disease}</div>
                    {p.icd10_code && (
                      <div
                        className="cns-icd10-tag"
                        title={
                          p.icd10_title_en ?? p.icd10_title_ru ?? undefined
                        }
                      >
                        МКБ-10: {p.icd10_code}
                      </div>
                    )}
                    <div className="cns-diag-card__bar">
                      <div
                        className="cns-diag-card__bar-fill"
                        style={{
                          width: `${Math.min(100, p.probability * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="cns-diag-card__pct">
                      {(p.probability * 100).toFixed(1)}%
                    </div>
                    {p.symptom_influences.length > 0 && (
                      <div className="cns-diag-card__influences">
                        <div className="cns-diag-card__inf-title">
                          Вклад отмеченных симптомов
                        </div>
                        <ul className="cns-diag-card__inf-list-weights">
                          {p.symptom_influences.map((si) => (
                            <li
                              key={si.symptom_key}
                              className="cns-diag-card__inf-item"
                            >
                              <span className="cns-diag-card__inf-label">
                                {si.symptom_label}
                              </span>
                              <code className="cns-diag-card__inf-weight">
                                : {si.weight}
                              </code>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Clarifying questions */}
            {diag.needs_clarification &&
              diag.clarifying_questions.length > 0 && (
                <div className="card card--elevated cns-card">
                  <h2 className="cns-card__title">Уточняющие вопросы</h2>
                  <p className="cns-card__sub">
                    Ответьте на вопросы для повышения точности диагноза
                  </p>
                  <div className="cns-clar-list">
                    {diag.clarifying_questions.map((q) => (
                      <div key={q.symptom_key} className="cns-clar-row">
                        <span className="cns-clar-label">
                          {q.symptom_label}?
                        </span>
                        <div className="cns-clar-btns">
                          <button
                            type="button"
                            className={`cns-clar-btn ${clarAnswers[q.symptom_key] === true ? "cns-clar-btn--yes" : ""}`}
                            onClick={() =>
                              setClarAnswers((a) => ({
                                ...a,
                                [q.symptom_key]: true,
                              }))
                            }
                          >
                            Да
                          </button>
                          <button
                            type="button"
                            className={`cns-clar-btn ${clarAnswers[q.symptom_key] === false ? "cns-clar-btn--no" : ""}`}
                            onClick={() =>
                              setClarAnswers((a) => ({
                                ...a,
                                [q.symptom_key]: false,
                              }))
                            }
                          >
                            Нет
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {Object.keys(clarAnswers).length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <button
                        type="button"
                        className="pts-add-btn"
                        disabled={busy}
                        onClick={() => void runDiagnose()}
                      >
                        {busy ? "Обновление…" : "Обновить диагноз"}
                      </button>
                    </div>
                  )}
                </div>
              )}
          </>
        )}

        {/* 3. NOTES */}
        <div className="card card--elevated cns-card">
          <h2 className="cns-card__title">Заметки врача</h2>
          <p className="cns-card__sub">
            Рекомендации, назначения, дата и время следующего визита
          </p>

          <div className="field">
            <label className="field__label">Заметки и назначения</label>
            <textarea
              className="textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Например: парацетамол по схеме, ОАК, СРБ через 5 дней…"
              rows={4}
            />
          </div>

          <div className="field field--md">
            <label className="field__label">
              Дата и время следующего визита
            </label>
            <input
              type="datetime-local"
              value={nextVisit}
              onChange={(e) => setNextVisit(e.target.value)}
            />
          </div>
        </div>

        {/* 4. SUMMARY & FEEDBACK (shows after diagnosis) */}
        {diag && (
          <>
            <div className="card card--elevated cns-card cns-summary">
              <h3 className="cns-summary__title">Итог консультации</h3>
              <div className="cns-summary__row">
                <span className="cns-summary__label">Симптомы</span>
                <div className="cns-chips" style={{ margin: 0 }}>
                  {selected.map((k) => (
                    <span key={k} className="cns-chip cns-chip--sm">
                      {labels[k] ?? k}
                    </span>
                  ))}
                </div>
              </div>
              <div className="cns-summary__row">
                <span className="cns-summary__label">Диагноз ИИ</span>
                <span style={{ fontWeight: 700, color: "#0a0e1a" }}>
                  {diag.predictions[0]?.disease}{" "}
                  {diag.predictions[0]?.icd10_code && (
                    <span
                      style={{
                        color: "#5a6078",
                        fontWeight: 500,
                        fontSize: "0.85em",
                      }}
                    >
                      [{diag.predictions[0].icd10_code}]
                    </span>
                  )}{" "}
                  <span style={{ color: "#4E67EB", fontWeight: 600 }}>
                    {(diag.predictions[0]?.probability * 100).toFixed(0)}%
                  </span>
                </span>
              </div>
              {doctorDiagnosis && (
                <div className="cns-summary__row">
                  <span className="cns-summary__label">Диагноз врача</span>
                  <span style={{ fontWeight: 700, color: "#16a34a" }}>
                    {doctorDiagnosis}
                    {doctorIcd10 && (
                      <span
                        style={{
                          color: "#5a6078",
                          fontWeight: 500,
                          fontSize: "0.85em",
                        }}
                      >
                        {" "}
                        · МКБ-10: {doctorIcd10}
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>

            <div className="card card--elevated cns-card">
              <h2 className="cns-card__title">Оценка ИИ-подсказки</h2>
              <p className="cns-card__sub">
                Помогает системе улучшать точность диагностики
              </p>
              <div className="cns-feedback-row">
                <button
                  type="button"
                  className={`cns-feedback-btn cns-feedback-btn--yes ${feedback === true ? "cns-feedback-btn--active-yes" : ""}`}
                  onClick={() => setFeedbackChoice(true)}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M2 8l4 4 8-8"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Диагноз верный
                </button>
                <button
                  type="button"
                  className={`cns-feedback-btn cns-feedback-btn--no ${feedback === false ? "cns-feedback-btn--active-no" : ""}`}
                  onClick={() => setFeedbackChoice(false)}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M2 2l12 12M14 2L2 14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  Диагноз неверный
                </button>
              </div>

              {feedback === false && (
                <div className="cns-doctor-dx" style={{ marginTop: 16 }}>
                  <p className="cns-card__sub" style={{ marginBottom: 10 }}>
                    Укажите верный диагноз из справочника (поиск с подсказками)
                  </p>
                  <div className="cns-search-wrap">
                    <input
                      className="pts-search-input"
                      value={diseaseInput}
                      onChange={(e) => setDiseaseInput(e.target.value)}
                      placeholder="Начните вводить название болезни…"
                      autoComplete="off"
                    />
                    {diseaseSuggestions.length > 0 && !doctorDiagnosis && (
                      <ul className="cns-suggest" role="listbox">
                        {diseaseSuggestions.map((s) => (
                          <li
                            key={s.name}
                            role="option"
                            tabIndex={0}
                            className="cns-suggest__item"
                            onClick={() => selectDoctorDiagnosis(s)}
                            onKeyDown={(e) =>
                              e.key === "Enter" && selectDoctorDiagnosis(s)
                            }
                          >
                            <span>{s.name}</span>
                            {s.icd10_code && (
                              <span className="cns-suggest__icd">
                                МКБ-10: {s.icd10_code}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {doctorDiagnosis && (
                    <div className="cns-chips" style={{ marginTop: 10 }}>
                      <span className="cns-chip">
                        <span>
                          {doctorDiagnosis}
                          {doctorIcd10 && (
                            <span className="cns-chip__icd">
                              {" "}
                              · {doctorIcd10}
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          className="cns-chip__remove"
                          onClick={() => {
                            setDoctorDiagnosis(null);
                            setDoctorIcd10(null);
                          }}
                          aria-label="Удалить диагноз"
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 10 10"
                            fill="none"
                          >
                            <path
                              d="M1 1l8 8M9 1L1 9"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {err && <p className="error">{err}</p>}

        {savedId !== null ? (
          <div className="cns-saved">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="9" fill="#16a34a" opacity="0.15" />
              <path
                d="M6 10l3 3 5-5"
                stroke="#16a34a"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Консультация сохранена.</span>
            <Link
              to={`/doctor/patients/${pid}`}
              style={{ color: "#4E67EB", fontWeight: 700 }}
            >
              Вернуться к карте пациента →
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              className="pts-add-btn"
              type="submit"
              disabled={
                busy ||
                feedback === null ||
                (feedback === false && !doctorDiagnosis)
              }
              style={{ fontSize: "0.95rem", padding: "12px 28px" }}
            >
              {busy ? "Сохранение…" : "Сохранить консультацию"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
