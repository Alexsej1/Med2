import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { api } from "../api";
import type { Consultation, Patient } from "../types";
import { useSymptomLabels } from "../SymptomLabelsContext";
import {
  notesSnippet,
  symptomsShort,
  topDiagnosisLine,
} from "./consultationDisplay";
import { formatDateTimeRu } from "./dateUtils";

export function DoctorHistory() {
  const { token } = useAuth();
  const symptomLabels = useSymptomLabels();
  const [rows, setRows] = useState<Consultation[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [feedbackFilter, setFeedbackFilter] = useState<
    "all" | "correct" | "wrong" | "none"
  >("all");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void Promise.all([api.consultations(token), api.patients(token)])
      .then(([c, p]) => {
        if (!cancelled) {
          setRows(c);
          setPatients(p);
        }
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Ошибка");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const name = (id: number) =>
    patients.find((p) => p.id === id)?.name ?? `#${id}`;

  const filtered = rows.filter((c) => {
    if (search) {
      const n = name(c.patient_id).toLowerCase();
      if (!n.includes(search.toLowerCase())) return false;
    }
    if (feedbackFilter === "correct" && c.diagnosis_feedback !== true)
      return false;
    if (feedbackFilter === "wrong" && c.diagnosis_feedback !== false)
      return false;
    if (feedbackFilter === "none" && c.diagnosis_feedback !== null)
      return false;
    return true;
  });

  const totalCorrect = rows.filter((r) => r.diagnosis_feedback === true).length;
  const accuracy =
    rows.length > 0
      ? Math.round(
          (totalCorrect /
            rows.filter((r) => r.diagnosis_feedback !== null).length) *
            100,
        ) || 0
      : 0;

  if (err) return <p className="error page-loading">{err}</p>;

  return (
    <div className="page-stack">
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>
            История консультаций
          </h1>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#9095a8" }}>
            {rows.length} записей всего
          </p>
        </div>
      </div>

      {/* Stats row */}
      {/* <div className="hist-stats">
        <div className="hist-stat">
          <span className="hist-stat__num">{rows.length}</span>
          <span className="hist-stat__label">Всего консультаций</span>
        </div>
        <div className="hist-stat-div" />
        <div className="hist-stat">
          <span className="hist-stat__num">{totalCorrect}</span>
          <span className="hist-stat__label">Верных ИИ-диагнозов</span>
        </div>
        <div className="hist-stat-div" />
        <div className="hist-stat">
          <span className="hist-stat__num" style={{ color: "#4E67EB" }}>
            {accuracy}%
          </span>
          <span className="hist-stat__label">Точность ИИ</span>
        </div>
        <div className="hist-stat-div" />
        <div className="hist-stat">
          <span className="hist-stat__num">
            {rows.filter((r) => r.next_visit_date).length}
          </span>
          <span className="hist-stat__label">Повторных визитов</span>
        </div>
      </div> */}

      {/* Toolbar */}
      <div className="hist-toolbar">
        <div className="pts-search-wrap" style={{ maxWidth: 360 }}>
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по пациенту…"
            autoComplete="off"
          />
          {search && (
            <button
              className="pts-search-clear"
              onClick={() => setSearch("")}
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M1 1l12 12M13 1L1 13"
                  stroke="#9095a8"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>
        {/* 
        <div className="hist-filters">
          {(["all", "correct", "wrong", "none"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`hist-filter-btn ${feedbackFilter === f ? "hist-filter-btn--active" : ""}`}
              onClick={() => setFeedbackFilter(f)}
            >
              {f === "all" && "Все"}
              {f === "correct" && "Верные"}
              {f === "wrong" && "Неверные"}
              {f === "none" && "Без оценки"}
            </button>
          ))}
        </div> */}
      </div>

      {/* Table */}
      <div className="pts-list-card">
        {filtered.length === 0 ? (
          <div className="pts-empty">
            <div className="pts-empty__icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect
                  x="4"
                  y="4"
                  width="24"
                  height="24"
                  rx="4"
                  stroke="#d1d5e0"
                  strokeWidth="1.5"
                />
                <path
                  d="M10 12h12M10 17h8M10 22h5"
                  stroke="#d1d5e0"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p className="pts-empty__title">Консультаций не найдено</p>
            <p className="pts-empty__sub">
              Попробуйте изменить фильтр или поисковый запрос
            </p>
          </div>
        ) : (
          <table className="pts-table">
            <thead>
              <tr>
                <th>Дата приёма</th>
                <th>Пациент</th>
                <th>Симптомы</th>
                <th>ИИ-диагноз</th>
                <th>След. визит</th>
                <th>Оценка ИИ</th>
                <th>Заметки</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="pts-table__row">
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div
                      style={{
                        fontWeight: 600,
                        color: "#0a0e1a",
                        fontSize: "0.88rem",
                      }}
                    >
                      {new Date(c.visit_at).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#9095a8" }}>
                      {new Date(c.visit_at).toLocaleTimeString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </td>
                  <td>
                    <Link
                      to={`/doctor/patients/${c.patient_id}`}
                      style={{
                        fontWeight: 600,
                        color: "#0a0e1a",
                        textDecoration: "none",
                      }}
                    >
                      {name(c.patient_id)}
                    </Link>
                  </td>
                  <td style={{ maxWidth: 180 }}>
                    <div className="hist-symptoms">
                      {symptomsShort(c.symptoms_json, 3, symptomLabels)
                        .split(", ")
                        .map((s, i) =>
                          s !== "—" ? (
                            <span key={i} className="hist-symptom-tag">
                              {s}
                            </span>
                          ) : (
                            <span key={i} style={{ color: "#9095a8" }}>
                              —
                            </span>
                          ),
                        )}
                    </div>
                  </td>
                  <td style={{ maxWidth: 160 }}>
                    <span
                      style={{
                        fontSize: "0.87rem",
                        fontWeight: 600,
                        color: "#0a0e1a",
                      }}
                    >
                      {topDiagnosisLine(c.diagnoses_json)}
                    </span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {c.next_visit_date ? (
                      <span className="pts-badge">
                        {formatDateTimeRu(c.next_visit_date)}
                      </span>
                    ) : (
                      <span style={{ color: "#9095a8", fontSize: "0.85rem" }}>
                        —
                      </span>
                    )}
                  </td>
                  <td>
                    {c.diagnosis_feedback === true && (
                      <span className="ppd-feedback ppd-feedback--ok">
                        Верно
                      </span>
                    )}
                    {c.diagnosis_feedback === false && (
                      <span className="ppd-feedback ppd-feedback--err">
                        Неверно
                      </span>
                    )}
                    {c.diagnosis_feedback === null && (
                      <span style={{ color: "#9095a8", fontSize: "0.85rem" }}>
                        —
                      </span>
                    )}
                  </td>
                  <td style={{ maxWidth: 160 }}>
                    <span style={{ fontSize: "0.83rem", color: "#5a6078" }}>
                      {notesSnippet(c.notes, 50)}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link
                      to={`/doctor/consultations/${c.id}`}
                      className="pts-row-btn"
                    >
                      Открыть
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                      >
                        <path
                          d="M3 7h8M8 4l3 3-3 3"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
