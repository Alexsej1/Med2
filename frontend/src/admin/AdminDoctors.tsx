import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "../AuthContext";
import { api } from "../api";
import { doctorDisplayName, type AdminDoctor } from "./doctorAdmin";

const emptyForm = { username: "", password: "", full_name: "" };

export function AdminDoctors() {
  const { token } = useAuth();
  const [doctors, setDoctors] = useState<AdminDoctor[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!token) return;
    setDoctors(await api.adminDoctors(token));
  }, [token]);

  useEffect(() => {
    void reload().catch((e) =>
      setErr(e instanceof Error ? e.message : "Ошибка"),
    );
  }, [reload]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setErr(null);
    setBusy(true);
    try {
      await api.adminCreateDoctor(token, {
        username: form.username.trim(),
        password: form.password,
        full_name: form.full_name.trim() || null,
      });
      setForm(emptyForm);
      await reload();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack">
      <h1 className="page-title">Врачи</h1>
      <p className="muted" style={{ marginTop: -8 }}>
        У каждого врача своя картотека пациентов. Войти можно под логином и
        паролем, которые вы задаёте здесь.
      </p>

      <div className="card card--elevated">
        <h2 className="card__title">Добавить врача</h2>
        <form onSubmit={onCreate} className="row">
          <div className="field">
            <label className="field__label">Логин</label>
            <input
              value={form.username}
              onChange={(e) =>
                setForm((f) => ({ ...f, username: e.target.value }))
              }
              placeholder="doctor2"
              required
              minLength={2}
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label className="field__label">Пароль</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div className="field" style={{ flex: "1 1 200px" }}>
            <label className="field__label">ФИО</label>
            <input
              value={form.full_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, full_name: e.target.value }))
              }
              placeholder="Петрова Анна Ивановна"
            />
          </div>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Сохранение…" : "Создать"}
          </button>
        </form>
        {err && <p className="error">{err}</p>}
      </div>

      <div className="card card--elevated" style={{ padding: 0 }}>
        <div style={{ padding: "20px 24px 0" }}>
          <h2 className="card__title" style={{ marginBottom: 0 }}>
            Список врачей
          </h2>
        </div>
        <table className="table" style={{ margin: 0 }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>ФИО</th>
              <th>Логин</th>
              <th>Пациентов</th>
            </tr>
          </thead>
          <tbody>
            {doctors.map((d) => (
              <tr key={d.id}>
                <td>{d.id}</td>
                <td>{doctorDisplayName(d.id, doctors)}</td>
                <td className="muted">{d.username}</td>
                <td>{d.patients_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {doctors.length === 0 && (
          <p className="muted" style={{ padding: "0 24px 20px" }}>
            Пока нет врачей. Создайте первого выше или запустите приложение
            (учётка doctor по умолчанию).
          </p>
        )}
      </div>
    </div>
  );
}
