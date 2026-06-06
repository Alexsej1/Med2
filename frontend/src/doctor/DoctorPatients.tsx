import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { api } from "../api";
import type { Patient } from "../types";

const genderRu: Record<string, string> = {
  male: "Мужской",
  female: "Женский",
  other: "Другой",
};

const emptyCreate = {
  name: "",
  birth_date: "",
  gender: "male",
  phone: "",
  email: "",
  address: "",
  policy_number: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  allergies: "",
  chronic_conditions: "",
  patient_notes: "",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2)
    return parts[0].slice(0, 2).toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

export function DoctorPatients() {
  const { token } = useAuth();
  const [list, setList] = useState<Patient[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [form, setForm] = useState(emptyCreate);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = "patient-create-modal-title";

  useEffect(() => {
    const trimmed = search.trim();
    if (!trimmed) {
      setDebouncedSearch("");
      return;
    }
    const t = setTimeout(() => setDebouncedSearch(trimmed), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoadErr(null);
    setLoading(true);
    try {
      setList(
        await api.patients(
          token,
          debouncedSearch ? { q: debouncedSearch } : undefined,
        ),
      );
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }, [token, debouncedSearch]);

  const listSubtitle = loading
    ? "Поиск…"
    : debouncedSearch
      ? list.length === 0
        ? "По запросу ничего не найдено"
        : `Найдено: ${list.length}`
      : `${list.length} записей в картотеке`;

  function clearSearch() {
    setSearch("");
    setDebouncedSearch("");
  }

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!modalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => {
      panelRef.current
        ?.querySelector<HTMLInputElement>("input:not([type=hidden])")
        ?.focus();
    }, 50);
    return () => {
      document.body.style.overflow = prev;
      window.clearTimeout(t);
    };
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setModalOpen(false);
        setCreateErr(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setCreateErr(null);
    try {
      await api.createPatient(token, {
        name: form.name.trim(),
        birth_date: form.birth_date,
        gender: form.gender,
        phone: form.phone.trim(),
        emergency_contact_name: form.emergency_contact_name.trim(),
        emergency_contact_phone: form.emergency_contact_phone.trim(),
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        policy_number: form.policy_number.trim() || null,
        allergies: form.allergies.trim() || null,
        chronic_conditions: form.chronic_conditions.trim() || null,
        patient_notes: form.patient_notes.trim() || null,
      });
      setForm(emptyCreate);
      setModalOpen(false);
      await load();
    } catch (ex) {
      setCreateErr(ex instanceof Error ? ex.message : "Ошибка");
    }
  }

  function closeModal() {
    setModalOpen(false);
    setCreateErr(null);
  }

  return (
    <>
      <div className="page-stack">
        {/* Header */}
        <div className="pts-header">
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>
              Пациенты
            </h1>
            <p className="pts-header__sub">{listSubtitle}</p>
          </div>
          <button
            type="button"
            className="pts-add-btn"
            onClick={() => setModalOpen(true)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1v14M1 8h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Новая карта
          </button>
        </div>

        {/* Search bar */}
        <div className="pts-search-row">
          <div className="pts-search-wrap">
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
              placeholder="ФИО, телефон, email или номер полиса"
              autoComplete="off"
              aria-label="Поиск пациентов"
            />
            {loading && (
              <span className="pts-search-spinner" aria-hidden="true" />
            )}
            {search && !loading && (
              <button
                className="pts-search-clear"
                onClick={clearSearch}
                type="button"
                aria-label="Очистить поиск"
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
          {loadErr && (
            <p className="error" style={{ margin: 0 }}>
              {loadErr}
            </p>
          )}
        </div>

        {/* Patient list */}
        <div
          className={`pts-list-card${loading ? " pts-list-card--loading" : ""}`}
        >
          {list.length === 0 && !loading ? (
            <div className="pts-empty">
              <div className="pts-empty__icon">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <rect
                    x="4"
                    y="8"
                    width="24"
                    height="18"
                    rx="3"
                    stroke="#d1d5e0"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M10 14h12M10 19h8"
                    stroke="#d1d5e0"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="24"
                    cy="8"
                    r="5"
                    fill="#f5f6fa"
                    stroke="#d1d5e0"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M22 8h4M24 6v4"
                    stroke="#d1d5e0"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <p className="pts-empty__title">
                {debouncedSearch ? "Ничего не найдено" : "Пациентов пока нет"}
              </p>
              <p className="pts-empty__sub">
                {debouncedSearch
                  ? "Попробуйте изменить запрос"
                  : "Добавьте первую амбулаторную карту"}
              </p>
              {!debouncedSearch && (
                <button
                  type="button"
                  className="pts-add-btn"
                  onClick={() => setModalOpen(true)}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M8 1v14M1 8h14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  Новая карта
                </button>
              )}
            </div>
          ) : list.length > 0 ? (
            <table className="pts-table">
              <thead>
                <tr>
                  <th>Пациент</th>
                  <th>Телефон</th>
                  <th>Возраст</th>
                  <th>Пол</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} className="pts-table__row">
                    <td>
                      <div className="pts-patient-cell">
                        <div className="pts-avatar">{initials(p.name)}</div>
                        <div>
                          <div className="pts-patient-name">{p.name}</div>
                          {p.email && (
                            <div className="pts-patient-email">{p.email}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="pts-td-muted">{p.phone ?? "—"}</td>
                    <td>
                      <span className="pts-badge">{p.age} лет</span>
                    </td>
                    <td className="pts-td-muted">
                      {genderRu[p.gender] ?? p.gender}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link
                        to={`/doctor/patients/${p.id}`}
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
          ) : null}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="modal" role="presentation">
          <button
            type="button"
            className="modal__backdrop"
            aria-label="Закрыть"
            onClick={closeModal}
          />
          <div
            ref={panelRef}
            className="modal__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal__head">
              <h2 id={titleId} className="modal__title">
                Новая амбулаторная карта
              </h2>
              <button
                type="button"
                className="modal__close"
                aria-label="Закрыть"
                onClick={closeModal}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M1 1l12 12M13 1L1 13"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <form
              onSubmit={onCreate}
              className="patient-create-form modal__form"
            >
              <fieldset className="form-section">
                <legend>Личные данные</legend>
                <div className="form-grid form-grid--3">
                  <div className="field field--span2">
                    <label className="field__label">ФИО полностью *</label>
                    <input
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                      required
                      minLength={2}
                      maxLength={128}
                      placeholder="Иванов Иван Иванович"
                    />
                  </div>
                  <div className="field">
                    <label className="field__label">Дата рождения *</label>
                    <input
                      type="date"
                      value={form.birth_date}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, birth_date: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="field">
                    <label className="field__label">Пол *</label>
                    <select
                      value={form.gender}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, gender: e.target.value }))
                      }
                    >
                      <option value="male">Мужской</option>
                      <option value="female">Женский</option>
                      <option value="other">Другой</option>
                    </select>
                  </div>
                </div>
              </fieldset>

              <fieldset className="form-section">
                <legend>Контакты и документы</legend>
                <div className="form-grid form-grid--2">
                  <div className="field">
                    <label className="field__label">Телефон *</label>
                    <input
                      value={form.phone}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, phone: e.target.value }))
                      }
                      required
                      minLength={10}
                      maxLength={64}
                      placeholder="+7 (999) 000-00-00"
                    />
                  </div>
                  <div className="field">
                    <label className="field__label">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, email: e.target.value }))
                      }
                      maxLength={256}
                    />
                  </div>
                  <div className="field field--span2">
                    <label className="field__label">Адрес</label>
                    <input
                      value={form.address}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, address: e.target.value }))
                      }
                      maxLength={1024}
                    />
                  </div>
                  <div className="field field--span2">
                    <label className="field__label">Номер полиса</label>
                    <input
                      value={form.policy_number}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          policy_number: e.target.value,
                        }))
                      }
                      maxLength={128}
                    />
                  </div>
                </div>
              </fieldset>

              <fieldset className="form-section">
                <legend>Экстренный контакт</legend>
                <div className="form-grid form-grid--2">
                  <div className="field">
                    <label className="field__label">
                      ФИО контактного лица *
                    </label>
                    <input
                      value={form.emergency_contact_name}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          emergency_contact_name: e.target.value,
                        }))
                      }
                      required
                      minLength={2}
                      maxLength={256}
                    />
                  </div>
                  <div className="field">
                    <label className="field__label">Телефон *</label>
                    <input
                      value={form.emergency_contact_phone}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          emergency_contact_phone: e.target.value,
                        }))
                      }
                      required
                      minLength={10}
                      maxLength={64}
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
                    value={form.allergies}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, allergies: e.target.value }))
                    }
                    maxLength={4000}
                  />
                </div>
                <div className="field">
                  <label className="field__label">
                    Хронические заболевания
                  </label>
                  <textarea
                    rows={2}
                    value={form.chronic_conditions}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        chronic_conditions: e.target.value,
                      }))
                    }
                    maxLength={4000}
                  />
                </div>
                <div className="field">
                  <label className="field__label">Заметки</label>
                  <textarea
                    rows={2}
                    value={form.patient_notes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, patient_notes: e.target.value }))
                    }
                    maxLength={4000}
                  />
                </div>
              </fieldset>

              {createErr && <p className="error modal__err">{createErr}</p>}

              <div className="modal__actions">
                <button
                  type="button"
                  className="btn secondary"
                  onClick={closeModal}
                >
                  Отмена
                </button>
                <button className="btn" type="submit">
                  Создать карту
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
