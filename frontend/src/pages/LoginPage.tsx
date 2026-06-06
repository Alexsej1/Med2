import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { BRAND_FULL } from "../brand";
import { useAuth } from "../AuthContext";

export function LoginPage() {
  const { user, login, loading } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState("doctor");
  const [password, setPassword] = useState("doctor123");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) {
    return (
      <Navigate to={user.role === "admin" ? "/admin" : "/doctor"} replace />
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const me = await login(username, password);
      nav(me.role === "admin" ? "/admin" : "/doctor", { replace: true });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Ошибка входа");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card motion-auth-card">
        <div className="auth-card__logo">
          <BrandMark />
        </div>
        <h1 className="auth-card__title">{BRAND_FULL}</h1>
        <p className="auth-card__lead">Вход в рабочий кабинет сотрудника</p>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label className="field__label">Логин</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="field">
            <label className="field__label">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {err && <p className="error">{err}</p>}
          <div className="card__actions" style={{ marginTop: 8 }}>
            <button
              className="btn btn--large"
              type="submit"
              disabled={busy || loading}
              style={{ width: "100%" }}
            >
              Войти
            </button>
          </div>
        </form>
        <p className="auth-back">
          <Link to="/">← На главную</Link>
        </p>
      </div>
    </div>
  );
}
