import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { api } from "../api";
import type { Consultation, Patient } from "../types";
import { formatDateTimeRu } from "./dateUtils";

const genderRu: Record<string, string> = {
  male: "Мужской",
  female: "Женский",
  other: "Другой",
};

function formatRuDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function calcAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const bd = new Date(birthDate + "T12:00:00");
  const today = new Date();
  let age = today.getFullYear() - bd.getFullYear();
  const m = today.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
  return age;
}

export function DoctorPatientDetail() {
  const { id } = useParams();
  const pid = Number(id);
  const { token } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [cons, setCons] = useState<Consultation[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "edit">(
    "overview",
  );

  // Edit state
  const [editName, setEditName] = useState("");
  const [editBirth, setEditBirth] = useState("");
  const [editGender, setEditGender] = useState("male");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editPolicy, setEditPolicy] = useState("");
  const [editEmergName, setEditEmergName] = useState("");
  const [editEmergPhone, setEditEmergPhone] = useState("");
  const [editAllergies, setEditAllergies] = useState("");
  const [editChronic, setEditChronic] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editMsg, setEditMsg] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);

  useEffect(() => {
    if (!token || !pid) return;
    let cancelled = false;
    (async () => {
      setErr(null);
      try {
        const [p, c] = await Promise.all([
          api.patient(token, pid),
          api.consultations(token, pid),
        ]);
        if (!cancelled) {
          setPatient(p);
          setCons(c);
          setEditName(p.name);
          setEditBirth(p.birth_date ?? "");
          setEditGender(p.gender);
          setEditPhone(p.phone ?? "");
          setEditEmail(p.email ?? "");
          setEditAddress(p.address ?? "");
          setEditPolicy(p.policy_number ?? "");
          setEditEmergName(p.emergency_contact_name ?? "");
          setEditEmergPhone(p.emergency_contact_phone ?? "");
          setEditAllergies(p.allergies ?? "");
          setEditChronic(p.chronic_conditions ?? "");
          setEditNotes(p.patient_notes ?? "");
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Ошибка");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, pid]);

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!token || !patient) return;
    setEditBusy(true);
    setEditMsg(null);
    try {
      const updated = await api.updatePatient(token, patient.id, {
        name: editName.trim(),
        gender: editGender,
        birth_date: editBirth || null,
        phone: editPhone.trim(),
        email: editEmail.trim() || null,
        address: editAddress.trim() || null,
        policy_number: editPolicy.trim() || null,
        emergency_contact_name: editEmergName.trim(),
        emergency_contact_phone: editEmergPhone.trim(),
        allergies: editAllergies.trim() || null,
        chronic_conditions: editChronic.trim() || null,
        patient_notes: editNotes.trim() || null,
      });
      setPatient(updated);
      setEditMsg("Сохранено");
    } catch (ex) {
      setEditMsg(ex instanceof Error ? ex.message : "Ошибка");
    } finally {
      setEditBusy(false);
    }
  }

  if (err) return <p className="error page-loading">{err}</p>;
  if (!patient) return <p className="muted page-loading">Загрузка…</p>;

  const age = calcAge(patient.birth_date) ?? patient.age;

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
        <span style={{ color: "#0a0e1a", fontWeight: 600 }}>
          {patient.name}
        </span>
      </nav>

      {/* Patient hero card */}
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
              <span>{age} лет</span>
              <span className="ppd-hero__dot" />
              <span>{genderRu[patient.gender] ?? patient.gender}</span>
              {patient.birth_date && (
                <>
                  <span className="ppd-hero__dot" />
                  <span>{formatRuDate(patient.birth_date)}</span>
                </>
              )}
            </div>
            <div className="ppd-hero__contacts">
              {patient.phone && (
                <span className="ppd-hero__contact-chip">{patient.phone}</span>
              )}
              {patient.email && (
                <span className="ppd-hero__contact-chip">{patient.email}</span>
              )}
            </div>
          </div>
        </div>
        <div className="ppd-hero__right">
          <Link
            to={`/doctor/patients/${patient.id}/lab-analysis`}
            className="btn secondary"
            style={{ alignSelf: "flex-start" }}
          >
            Лабораторный анализ
          </Link>
          <Link
            to={`/doctor/patients/${patient.id}/consultation`}
            className="ppd-new-btn"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path
                d="M7.5 1v13M1 7.5h13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Новая консультация
          </Link>
          <div className="ppd-hero__stats">
            <div className="ppd-hero__stat">
              <span className="ppd-hero__stat-num">{cons.length}</span>
              <span className="ppd-hero__stat-label">визитов</span>
            </div>
            <div className="ppd-hero__stat-divider" />
            <div className="ppd-hero__stat">
              <span className="ppd-hero__stat-num">
                {cons.filter((c) => c.diagnosis_feedback === true).length}
              </span>
              <span className="ppd-hero__stat-label">верных ИИ</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="ppd-tabs">
        {(["overview", "history", "edit"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`ppd-tab ${activeTab === tab ? "ppd-tab--active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "overview" && "Сводка"}
            {tab === "history" && `История · ${cons.length}`}
            {tab === "edit" && "Редактировать"}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="ppd-overview-grid">
          {/* Left col */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card card--elevated">
              <h3 className="ppd-section-title">Контактная информация</h3>
              <dl className="ppd-dl">
                <div className="ppd-dl__row">
                  <dt>Телефон</dt>
                  <dd>{patient.phone ?? "—"}</dd>
                </div>
                <div className="ppd-dl__row">
                  <dt>Email</dt>
                  <dd>{patient.email ?? "—"}</dd>
                </div>
                <div className="ppd-dl__row">
                  <dt>Адрес</dt>
                  <dd>{patient.address ?? "—"}</dd>
                </div>
                <div className="ppd-dl__row">
                  <dt>Полис</dt>
                  <dd>{patient.policy_number ?? "—"}</dd>
                </div>
              </dl>
            </div>

            <div className="card card--elevated">
              <h3 className="ppd-section-title">Экстренный контакт</h3>
              <dl className="ppd-dl">
                <div className="ppd-dl__row">
                  <dt>ФИО</dt>
                  <dd>{patient.emergency_contact_name ?? "—"}</dd>
                </div>
                <div className="ppd-dl__row">
                  <dt>Телефон</dt>
                  <dd>{patient.emergency_contact_phone ?? "—"}</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Right col */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {patient.allergies && (
              <div className="card card--elevated ppd-alert-card ppd-alert-card--red">
                <h3 className="ppd-section-title">Аллергии</h3>
                <p className="ppd-card-text">{patient.allergies}</p>
              </div>
            )}

            {patient.chronic_conditions && (
              <div className="card card--elevated ppd-alert-card ppd-alert-card--yellow">
                <h3 className="ppd-section-title">Хронические заболевания</h3>
                <p className="ppd-card-text">{patient.chronic_conditions}</p>
              </div>
            )}

            {patient.patient_notes && (
              <div className="card card--elevated">
                <h3 className="ppd-section-title">Заметки</h3>
                <p className="ppd-card-text">{patient.patient_notes}</p>
              </div>
            )}

            {!patient.allergies &&
              !patient.chronic_conditions &&
              !patient.patient_notes && (
                <div
                  className="card card--elevated"
                  style={{ textAlign: "center", padding: "32px 24px" }}
                >
                  <p
                    style={{ color: "#9095a8", fontSize: "0.9rem", margin: 0 }}
                  >
                    Медицинские заметки не добавлены
                  </p>
                </div>
              )}
          </div>
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === "history" && (
        <div
          className="card card--elevated"
          style={{ padding: 0, overflow: "hidden" }}
        >
          {cons.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center" }}>
              <p style={{ color: "#9095a8", margin: 0 }}>
                Консультаций пока нет
              </p>
              <Link
                to={`/doctor/patients/${patient.id}/consultation`}
                className="ppd-new-btn"
                style={{ display: "inline-flex", marginTop: 16 }}
              >
                Провести первую
              </Link>
            </div>
          ) : (
            <table className="pts-table">
              <thead>
                <tr>
                  <th>Дата приёма</th>
                  <th>Следующий визит</th>
                  <th>ИИ-оценка</th>
                  <th>Заметки</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cons.map((c) => (
                  <tr key={c.id} className="pts-table__row">
                    <td>
                      <span style={{ fontWeight: 600, color: "#0a0e1a" }}>
                        {new Date(c.visit_at).toLocaleDateString("ru-RU", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </td>
                    <td>
                      {c.next_visit_date ? (
                        <span className="pts-badge">
                          {formatDateTimeRu(c.next_visit_date)}
                        </span>
                      ) : (
                        <span style={{ color: "#9095a8" }}>—</span>
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
                    <td
                      style={{
                        maxWidth: 200,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: "#5a6078",
                        fontSize: "0.87rem",
                      }}
                    >
                      {c.notes ?? "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link
                        to={`/doctor/consultations/${c.id}`}
                        className="pts-row-btn"
                      >
                        Подробнее
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
      )}

      {/* EDIT TAB */}
      {activeTab === "edit" && (
        <div className="card card--elevated">
          <form onSubmit={onSaveEdit} className="patient-create-form">
            <fieldset className="form-section">
              <legend>Личные данные</legend>
              <div className="form-grid form-grid--3">
                <div className="field field--span2">
                  <label className="field__label">ФИО</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    minLength={2}
                  />
                </div>
                <div className="field">
                  <label className="field__label">Дата рождения</label>
                  <input
                    type="date"
                    value={editBirth}
                    onChange={(e) => setEditBirth(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="field__label">Пол</label>
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value)}
                  >
                    <option value="male">Мужской</option>
                    <option value="female">Женский</option>
                    <option value="other">Другой</option>
                  </select>
                </div>
              </div>
            </fieldset>

            <fieldset className="form-section">
              <legend>Контакты</legend>
              <div className="form-grid form-grid--2">
                <div className="field">
                  <label className="field__label">Телефон</label>
                  <input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    required
                    minLength={10}
                  />
                </div>
                <div className="field">
                  <label className="field__label">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                </div>
                <div className="field field--span2">
                  <label className="field__label">Адрес</label>
                  <input
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                  />
                </div>
                <div className="field field--span2">
                  <label className="field__label">Полис</label>
                  <input
                    value={editPolicy}
                    onChange={(e) => setEditPolicy(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="field__label">
                    Экстренный контакт (ФИО)
                  </label>
                  <input
                    value={editEmergName}
                    onChange={(e) => setEditEmergName(e.target.value)}
                    required
                    minLength={2}
                  />
                </div>
                <div className="field">
                  <label className="field__label">
                    Экстренный контакт (тел.)
                  </label>
                  <input
                    value={editEmergPhone}
                    onChange={(e) => setEditEmergPhone(e.target.value)}
                    required
                    minLength={10}
                  />
                </div>
              </div>
            </fieldset>

            <fieldset className="form-section">
              <legend>Медицинская информация</legend>
              <div className="field">
                <label className="field__label">Аллергии</label>
                <textarea
                  rows={2}
                  value={editAllergies}
                  onChange={(e) => setEditAllergies(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field__label">Хронические заболевания</label>
                <textarea
                  rows={2}
                  value={editChronic}
                  onChange={(e) => setEditChronic(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field__label">Заметки по карте</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>
            </fieldset>

            <div
              className="form-actions"
              style={{ display: "flex", alignItems: "center", gap: 12 }}
            >
              <button className="btn" type="submit" disabled={editBusy}>
                Сохранить изменения
              </button>
              {editMsg && (
                <p
                  className={editMsg === "Сохранено" ? "form-success" : "error"}
                  style={{ margin: 0 }}
                >
                  {editMsg}
                </p>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
