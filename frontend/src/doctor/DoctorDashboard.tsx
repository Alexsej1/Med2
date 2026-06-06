import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { api } from "../api";
import type { DoctorSummary } from "../types";
import { formatDateTimeRu } from "./dateUtils";

export function DoctorDashboard() {
  const { token } = useAuth();
  const [data, setData] = useState<DoctorSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      setData(await api.doctorSummary(token));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (err) return <p className="error page-loading">{err}</p>;
  if (!data) return <p className="muted page-loading">Загрузка…</p>;

  return (
    <div className="page-stack">
      {/* Header row */}
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
            Обзор
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: "0.9rem",
              color: "#9095a8",
              fontWeight: 500,
            }}
          >
            Добро пожаловать в MedExpert
          </p>
        </div>
        <Link
          to="/doctor/patients"
          className="btn"
          style={{ alignSelf: "center" }}
        >
          + Новый пациент
        </Link>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#9095a8",
              marginBottom: 12,
            }}
          >
            Пациентов
          </div>
          <div className="stat-card__value">{data.patients_total}</div>
          <div className="stat-card__label">в картотеке</div>
          <Link to="/doctor/patients" className="stat-card__link">
            Открыть список →
          </Link>
        </div>

        <div className="stat-card">
          <div
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#9095a8",
              marginBottom: 12,
            }}
          >
            Консультации
          </div>
          <div className="stat-card__value">{data.consultations_total}</div>
          <div className="stat-card__label">всего проведено</div>
          <Link to="/doctor/history" className="stat-card__link">
            Журнал →
          </Link>
        </div>

        <div className="stat-card">
          <div
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#9095a8",
              marginBottom: 12,
            }}
          >
            За 7 дней
          </div>
          <div className="stat-card__value">
            {data.consultations_last_7_days}
          </div>
          <div className="stat-card__label">приёмов на этой неделе</div>
          <Link to="/doctor/calendar" className="stat-card__link">
            Календарь →
          </Link>
        </div>

        <div
          className="stat-card"
          style={{ background: "#4E67EB", borderColor: "#4E67EB" }}
        >
          <div
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "rgba(255,255,255,0.6)",
              marginBottom: 12,
            }}
          >
            Повторных визитов
          </div>
          <div className="stat-card__value" style={{ color: "#fff" }}>
            {data.upcoming_visits.length}
          </div>
          <div
            className="stat-card__label"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            запланировано
          </div>
          <Link
            to="/doctor/calendar"
            className="stat-card__link"
            style={{ color: "rgba(255,255,255,0.9)" }}
          >
            Расписание →
          </Link>
        </div>
      </div>

      {/* Upcoming visits table */}
      <div
        className="card card--elevated"
        style={{ padding: 0, overflow: "hidden" }}
      >
        <div
          style={{
            padding: "20px 24px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <h2 className="card__title" style={{ margin: 0 }}>
            Ближайшие повторные визиты
          </h2>
          <Link
            to="/doctor/calendar"
            className="btn secondary"
            style={{ fontSize: "0.82rem", padding: "7px 14px" }}
          >
            Весь календарь
          </Link>
        </div>

        {data.upcoming_visits.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>📅</div>
            <p style={{ margin: 0, color: "#9095a8", fontSize: "0.9rem" }}>
              Нет запланированных визитов
            </p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Пациент</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.upcoming_visits.map((v) => (
                <tr key={v.consultation_id}>
                  <td>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: "#eef1fd",
                        color: "#4E67EB",
                        fontWeight: 700,
                        fontSize: "0.82rem",
                        padding: "4px 10px",
                        borderRadius: 8,
                      }}
                    >
                      {formatDateTimeRu(v.next_visit_date)}
                    </span>
                  </td>
                  <td>
                    <Link
                      to={`/doctor/patients/${v.patient_id}`}
                      style={{ fontWeight: 600, color: "#0a0e1a" }}
                    >
                      {v.patient_name}
                    </Link>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link
                      to={`/doctor/patients/${v.patient_id}`}
                      className="btn secondary"
                      style={{ fontSize: "0.8rem", padding: "6px 12px" }}
                    >
                      Карточка →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Link
          to="/doctor/patients"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            background: "#fff",
            border: "1px solid #e8e9f0",
            borderRadius: 20,
            padding: "22px 24px",
            textDecoration: "none",
            transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor =
              "rgba(78,103,235,0.4)";
            (e.currentTarget as HTMLElement).style.transform =
              "translateY(-2px)";
            (e.currentTarget as HTMLElement).style.boxShadow =
              "0 8px 24px rgba(78,103,235,0.1)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "#e8e9f0";
            (e.currentTarget as HTMLElement).style.transform = "";
            (e.currentTarget as HTMLElement).style.boxShadow = "";
          }}
        >
          <span
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 800,
              fontSize: "1rem",
              color: "#0a0e1a",
            }}
          >
            Пациенты
          </span>
          <span style={{ fontSize: "0.85rem", color: "#9095a8" }}>
            Картотека и новые карты
          </span>
        </Link>

        <Link
          to="/doctor/calendar"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            background: "#fff",
            border: "1px solid #e8e9f0",
            borderRadius: 20,
            padding: "22px 24px",
            textDecoration: "none",
            transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor =
              "rgba(78,103,235,0.4)";
            (e.currentTarget as HTMLElement).style.transform =
              "translateY(-2px)";
            (e.currentTarget as HTMLElement).style.boxShadow =
              "0 8px 24px rgba(78,103,235,0.1)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "#e8e9f0";
            (e.currentTarget as HTMLElement).style.transform = "";
            (e.currentTarget as HTMLElement).style.boxShadow = "";
          }}
        >
          <span
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 800,
              fontSize: "1rem",
              color: "#0a0e1a",
            }}
          >
            Расписание
          </span>
          <span style={{ fontSize: "0.85rem", color: "#9095a8" }}>
            Визиты и повторные приёмы
          </span>
        </Link>
      </div>
    </div>
  );
}
