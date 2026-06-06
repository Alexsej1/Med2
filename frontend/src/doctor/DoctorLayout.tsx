import { Link, Navigate, NavLink, Outlet } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { BRAND_SHORT } from "../brand";
import { useAuth } from "../AuthContext";
import { SymptomLabelsProvider } from "../SymptomLabelsContext";
import { VisitNotificationToasts } from "./VisitNotificationToasts";
import { useUpcomingVisitNotifications } from "./useUpcomingVisitNotifications";
export function RequireDoctor() {
  const { user, loading, token } = useAuth();
  if (loading) return <p className="muted page-loading">Загрузка…</p>;
  if (!token || !user) return <Navigate to="/login" replace />;
  if (user.role !== "doctor") return <Navigate to="/admin" replace />;
  return <Outlet />;
}

export function DoctorLayout() {
  const { user, logout, token } = useAuth();
  const { toasts, dismissToast } = useUpcomingVisitNotifications(token);
  return (
    <div className="app-shell app-shell--workspace">
      <header className="topbar topbar--workspace">
        <Link to="/doctor" className="topbar__brand">
          <BrandMark compact />
          <div className="topbar__brand-text">
            <span className="topbar__name">{BRAND_SHORT}</span>
          </div>
        </Link>
        <nav className="nav nav--workspace">
          <NavLink
            to="/doctor"
            end
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Обзор
          </NavLink>
          <NavLink
            to="/doctor/patients"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Пациенты
          </NavLink>
          <NavLink
            to="/doctor/calendar"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Календарь
          </NavLink>
          <NavLink
            to="/doctor/history"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            История
          </NavLink>
        </nav>
        <div className="topbar__user topbar__user--workspace">
          <span title={user?.username}>
            {user?.full_name || user?.username}
          </span>
          <button type="button" className="btn secondary" onClick={logout}>
            Выход
          </button>
        </div>
      </header>
      <main className="page page--enter page--workspace">
        <SymptomLabelsProvider>
          <Outlet />
        </SymptomLabelsProvider>
      </main>
      <VisitNotificationToasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
