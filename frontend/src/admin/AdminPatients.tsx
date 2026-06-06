import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../AuthContext";
import { api } from "../api";
import type { Patient } from "../types";
import { doctorDisplayName, type AdminDoctor } from "./doctorAdmin";

type SortKey = "name" | "doctor" | "created";

export function AdminPatients() {
  const { token } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<AdminDoctor[]>([]);
  const [doctorFilter, setDoctorFilter] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const [d, p] = await Promise.all([
        api.adminDoctors(token),
        api.patients(token, {
          doctorId: doctorFilter === "all" ? undefined : doctorFilter,
          q: search.trim() || undefined,
        }),
      ]);
      setDoctors(d);
      setPatients(p);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }, [token, doctorFilter, search]);

  useEffect(() => {
    const t = setTimeout(() => void load(), search.trim() ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const sorted = useMemo(() => {
    const list = [...patients];
    list.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name, "ru");
      if (sortBy === "doctor") {
        const da = doctorDisplayName(a.doctor_id, doctors);
        const db = doctorDisplayName(b.doctor_id, doctors);
        const c = da.localeCompare(db, "ru");
        return c !== 0 ? c : a.name.localeCompare(b.name, "ru");
      }
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
    return list;
  }, [patients, sortBy, doctors]);

  return (
    <div className="page-stack">
      <h1 className="page-title">Все пациенты</h1>

      <div className="card card--elevated">
        <div
          className="row"
          style={{ alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}
        >
          <div className="field" style={{ flex: "1 1 200px" }}>
            <label className="field__label">Поиск</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ФИО, телефон, полис…"
            />
          </div>
          <div className="field">
            <label className="field__label">Врач</label>
            <select
              value={doctorFilter === "all" ? "all" : String(doctorFilter)}
              onChange={(e) =>
                setDoctorFilter(
                  e.target.value === "all" ? "all" : Number(e.target.value),
                )
              }
            >
              <option value="all">Все врачи</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {doctorDisplayName(d.id, doctors)} ({d.patients_count})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label">Сортировка</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
            >
              <option value="name">По ФИО</option>
              <option value="doctor">По врачу</option>
              <option value="created">Сначала новые</option>
            </select>
          </div>
        </div>
        {err && <p className="error">{err}</p>}
      </div>

      <div className="card card--elevated" style={{ padding: 0 }}>
        <div style={{ padding: "20px 24px 12px" }}>
          <h2 className="card__title" style={{ margin: 0 }}>
            {loading ? "Загрузка…" : `Найдено: ${sorted.length}`}
          </h2>
        </div>
        <table className="table" style={{ margin: 0 }}>
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Врач</th>
              <th>Телефон</th>
              <th>Возраст</th>
              <th>Добавлен</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td>{doctorDisplayName(p.doctor_id, doctors)}</td>
                <td className="muted">{p.phone ?? "—"}</td>
                <td>{p.age}</td>
                <td className="nowrap muted">
                  {new Date(p.created_at).toLocaleDateString("ru-RU")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && sorted.length === 0 && (
          <p className="muted" style={{ padding: "0 24px 20px" }}>
            Нет пациентов по выбранным фильтрам
          </p>
        )}
      </div>
    </div>
  );
}
