import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { api, fetchLabAnalysisPdf } from "../api";
import { AIInterpretation, IndicatorRow, UploadForm } from "../components/lab";
import type { LabAnalysis, LabAnalysisListItem, Patient } from "../types";
import { formatDateTimeRu } from "./dateUtils";

function formatTestDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function DoctorLabAnalysis() {
  const { id } = useParams();
  const pid = Number(id);
  const { token } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [history, setHistory] = useState<LabAnalysisListItem[]>([]);
  const [selected, setSelected] = useState<LabAnalysis | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    if (!token || !pid) return;
    let cancelled = false;
    (async () => {
      setErr(null);
      try {
        const [p, list] = await Promise.all([
          api.patient(token, pid),
          api.labAnalyses(token, pid),
        ]);
        if (!cancelled) {
          setPatient(p);
          setHistory(list);
          if (list.length > 0) setSelectedId(list[0].id);
        }
      } catch (e) {
        if (!cancelled)
          setErr(e instanceof Error ? e.message : "Ошибка загрузки");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, pid]);

  useEffect(() => {
    if (!token || !selectedId) {
      setSelected(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void api
      .labAnalysis(token, selectedId)
      .then((detail) => {
        if (!cancelled) setSelected(detail);
      })
      .catch((e) => {
        if (!cancelled)
          setErr(
            e instanceof Error ? e.message : "Не удалось загрузить анализ",
          );
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, selectedId]);

  async function handleUpload(file: File) {
    if (!token || !pid) return;
    setErr(null);
    const created = await api.uploadLabAnalysis(token, pid, file);
    const listItem: LabAnalysisListItem = {
      id: created.id,
      patient_id: created.patient_id,
      original_filename: created.original_filename,
      test_type: created.test_type,
      test_date: created.test_date,
      uploaded_at: created.created_at,
      flagged_count: created.flagged_count,
      total_count: created.total_count,
      status: created.status,
    };
    setHistory((prev) => [listItem, ...prev]);
    setSelectedId(created.id);
    setSelected(created);
  }

  async function downloadReport() {
    if (!token || !selected?.id) return;
    setPdfBusy(true);
    setErr(null);
    try {
      const blob = await fetchLabAnalysisPdf(token, selected.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lab-analysis-${selected.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось скачать отчёт");
    } finally {
      setPdfBusy(false);
    }
  }

  if (!patient) {
    return <p className="muted page-loading">{err ?? "Загрузка…"}</p>;
  }

  const listMeta = history.find((h) => h.id === selectedId);

  return (
    <div className="lab-page">
      <div className="lab-page__head">
        <Link to={`/doctor/patients/${pid}`} className="back-link">
          ← {patient.name}
        </Link>
        <h1 className="page-title">Лабораторные анализы</h1>
      </div>

      {err && <p className="error-banner">{err}</p>}

      <UploadForm onUpload={handleUpload} />

      <div className="lab-page__body">
        <aside className="card card--elevated lab-history">
          <h3 className="ppd-section-title">История анализов</h3>
          {history.length === 0 ? (
            <p className="muted">Пока нет загруженных анализов</p>
          ) : (
            <ul className="lab-history__list">
              {history.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className={`lab-history__item ${selectedId === a.id ? "lab-history__item--active" : ""}`}
                    onClick={() => setSelectedId(a.id)}
                  >
                    <span className="lab-history__name">
                      📋 {a.test_type ?? a.original_filename}
                    </span>
                    {a.test_date && (
                      <span className="lab-history__date">
                        от {formatTestDate(a.test_date)}
                      </span>
                    )}
                    <span className="lab-history__flags">
                      Отклонений: {a.flagged_count} из {a.total_count}
                    </span>
                    <span className="lab-history__date muted">
                      {formatDateTimeRu(a.uploaded_at)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="lab-page__detail">
          {detailLoading && <p className="muted">Загрузка результата…</p>}
          {!detailLoading && selected && (
            <>
              <div className="lab-result-card card card--elevated">
                <div className="lab-result-card__head">
                  <h2 className="lab-result-card__title">
                    📋 {selected.test_type ?? "Лабораторный анализ"}
                    {selected.test_date
                      ? ` от ${formatTestDate(selected.test_date)}`
                      : ""}
                  </h2>
                  <div className="lab-result-card__actions">
                    <span className="lab-result-card__stats">
                      Отклонений: {selected.flagged_count} из{" "}
                      {selected.total_count}
                    </span>
                    <button
                      type="button"
                      className="btn secondary btn--sm"
                      onClick={() => void downloadReport()}
                      disabled={pdfBusy || selected.status !== "done"}
                    >
                      {pdfBusy ? "Формирование…" : "Скачать отчёт PDF"}
                    </button>
                  </div>
                </div>
                {selected.lab_name && (
                  <p className="muted lab-detail__meta">
                    Лаборатория: {selected.lab_name}
                  </p>
                )}

                <div className="lab-indicators-list">
                  {selected.indicators.map((ind, idx) => (
                    <IndicatorRow
                      key={ind.id ?? `${ind.name}-${idx}`}
                      indicator={ind}
                    />
                  ))}
                </div>
              </div>

              {selected.ai_interpretation && (
                <AIInterpretation
                  text={selected.ai_interpretation}
                  flaggedCount={selected.flagged_count}
                  totalCount={selected.total_count}
                />
              )}
            </>
          )}
          {!detailLoading && !selected && !listMeta && (
            <div className="card card--elevated lab-empty">
              <p className="muted">Загрузите первый бланк анализа</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
