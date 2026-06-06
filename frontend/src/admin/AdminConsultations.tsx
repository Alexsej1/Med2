import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "../AuthContext";
import { api } from "../api";
import type { Consultation, Patient } from "../types";
import { datetimeLocalToApiIso } from "../doctor/dateUtils";

function doctorDisplayName(
  doctorId: number,
  doctors: { id: number; username: string; full_name: string | null }[],
): string {
  const d = doctors.find((x) => x.id === doctorId);
  if (!d) return `врач (id ${doctorId})`;
  const name = d.full_name?.trim();
  return name || d.username;
}

export function AdminConsultations() {
  const { token } = useAuth();
  const [rows, setRows] = useState<Consultation[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<
    { id: number; username: string; full_name: string | null }[]
  >([]);
  const [patientId, setPatientId] = useState<number | "">("");
  const [doctorId, setDoctorId] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [nextVisit, setNextVisit] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    const [c, p, d] = await Promise.all([
      api.consultations(token),
      api.patients(token),
      api.adminDoctors(token),
    ]);
    setRows(c);
    setPatients(p);
    setDoctors(d);
    setDoctorId((prev) => (prev === "" && d[0] ? d[0].id : prev));
    setPatientId((prev) => (prev === "" && p[0] ? p[0].id : prev));
  }, [token]);

  useEffect(() => {
    void reload().catch((e) =>
      setErr(e instanceof Error ? e.message : "Ошибка"),
    );
  }, [reload]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!token || patientId === "" || doctorId === "") return;
    setErr(null);
    try {
      await api.adminCreateConsultation(token, {
        patient_id: Number(patientId),
        doctor_id: Number(doctorId),
        notes: notes || null,
        next_visit_date: datetimeLocalToApiIso(nextVisit),
        symptom_keys: [],
        diagnoses: { source: "admin_manual" },
        diagnosis_feedback: null,
      });
      setNotes("");
      setNextVisit("");
      await reload();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Ошибка");
    }
  }

  async function onDelete(id: number) {
    if (!token) return;
    if (!confirm("Удалить консультацию?")) return;
    setErr(null);
    try {
      await api.adminDeleteConsultation(token, id);
      await reload();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Ошибка");
    }
  }

  const patientName = (id: number) =>
    patients.find((p) => p.id === id)?.name ?? `#${id}`;

  return (
    <div className="page-stack">
      <h1 className="page-title">Управление консультациями</h1>
      <div className="card card--elevated">
        <h2 className="card__title">Добавить запись</h2>
        <form onSubmit={onAdd} className="row">
          <div className="field">
            <label className="field__label">Пациент</label>
            <select
              value={patientId}
              onChange={(e) => setPatientId(Number(e.target.value))}
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {doctorDisplayName(p.doctor_id, doctors)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label">Врач</label>
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(Number(e.target.value))}
            >
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name || d.username}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label">След. визит (дата и время)</label>
            <input
              type="datetime-local"
              value={nextVisit}
              onChange={(e) => setNextVisit(e.target.value)}
            />
          </div>
          <div className="field" style={{ flex: "1 1 240px" }}>
            <label className="field__label">Комментарий</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Запись администратора"
            />
          </div>
          <button className="btn" type="submit">
            Добавить
          </button>
        </form>
        {err && <p className="error">{err}</p>}
      </div>

      <div className="card card--elevated" style={{ padding: 0 }}>
        <div style={{ padding: "20px 24px 0" }}>
          <h2 className="card__title" style={{ marginBottom: 0 }}>
            Все консультации
          </h2>
        </div>
        <table className="table" style={{ margin: 0 }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Пациент</th>
              <th>Врач</th>
              <th>Визит</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{patientName(c.patient_id)}</td>
                <td>{doctorDisplayName(c.doctor_id, doctors)}</td>
                <td>{new Date(c.visit_at).toLocaleString("ru-RU")}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn--danger"
                    onClick={() => void onDelete(c.id)}
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="muted" style={{ padding: "0 24px 20px" }}>
            Нет данных
          </p>
        )}
      </div>
    </div>
  );
}
