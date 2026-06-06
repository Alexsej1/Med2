import { Link, Navigate, NavLink, Outlet } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { BRAND_SHORT } from "../brand";
import { useAuth } from "../AuthContext";

export function RequireAdmin() {
  const { user, loading, token } = useAuth();
  if (loading) return <p className="muted page-loading">Загрузка…</p>;
  if (!token || !user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/doctor" replace />;
  return <Outlet />;
}

export function AdminLayout() {
  const { user, logout } = useAuth();
  return (
    <div className="app-shell app-shell--workspace">
      <header className="topbar topbar--workspace">
        <Link to="/admin" className="topbar__brand">
          <BrandMark compact />
          <div className="topbar__brand-text">
            <span className="topbar__name">{BRAND_SHORT}</span>
            <span className="topbar__role">Администратор</span>
          </div>
        </Link>
        <nav className="nav nav--workspace">
          <NavLink
            to="/admin/patients"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Пациенты
          </NavLink>
          <NavLink
            to="/admin/doctors"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Врачи
          </NavLink>
          <NavLink
            to="/admin/consultations"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Консультации
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
        <Outlet />
      </main>
    </div>
  );
}
