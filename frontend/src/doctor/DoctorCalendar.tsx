import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { api } from "../api";
import type { CalendarDay, Consultation, Patient } from "../types";
import {
  addDays,
  addMonths,
  endOfMonth,
  maxDate,
  minDate,
  parseISODateLocal,
  startOfMonth,
  toISODateLocal,
} from "./dateUtils";

function dedupeById(consultations: Consultation[]): Consultation[] {
  const m = new Map<number, Consultation>();
  for (const c of consultations) m.set(c.id, c);
  return [...m.values()];
}

export function DoctorCalendar() {
  const { token } = useAuth();
  const [monthAnchor, setMonthAnchor] = useState(() =>
    startOfMonth(new Date()),
  );
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    toISODateLocal(new Date()),
  );
  const [view, setView] = useState<"week" | "day">("week");
  const [err, setErr] = useState<string | null>(null);

  const today = useMemo(() => toISODateLocal(new Date()), []);

  const rangeStart = useMemo(() => {
    const first = startOfMonth(monthAnchor);
    return toISODateLocal(minDate(first, new Date()));
  }, [monthAnchor]);

  const rangeEnd = useMemo(() => {
    const last = endOfMonth(monthAnchor);
    const horizon = addDays(new Date(), 75);
    return toISODateLocal(maxDate(last, horizon));
  }, [monthAnchor]);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const [cal, plist] = await Promise.all([
        api.calendar(token, rangeStart, rangeEnd),
        api.patients(token),
      ]);
      setCalendarDays(cal);
      setPatients(plist);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    }
  }, [token, rangeStart, rangeEnd]);

  useEffect(() => {
    void load();
  }, [load]);

  const dayMap = useMemo(
    () => new Map(calendarDays.map((d) => [d.date, d])),
    [calendarDays],
  );

  const patientName = useCallback(
    (id: number) => patients.find((p) => p.id === id)?.name ?? `Пациент #${id}`,
    [patients],
  );

  const weekDays = useMemo(() => {
    const base = parseISODateLocal(selectedDate);
    const dow = (base.getDay() + 6) % 7;
    const monday = new Date(base);
    monday.setDate(monday.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return toISODateLocal(d);
    });
  }, [selectedDate]);

  const monthCells = useMemo(() => {
    const first = startOfMonth(monthAnchor);
    const startWeekday = (first.getDay() + 6) % 7;
    const cells: { iso: string; inMonth: boolean }[] = [];
    const cursor = new Date(first);
    cursor.setDate(cursor.getDate() - startWeekday);
    for (let i = 0; i < 42; i++) {
      const iso = toISODateLocal(cursor);
      cells.push({
        iso,
        inMonth: cursor.getMonth() === monthAnchor.getMonth(),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return cells;
  }, [monthAnchor]);

  const upcoming = useMemo(() => {
    const list: Consultation[] = [];
    for (const d of calendarDays) {
      for (const c of d.consultations) {
        if (c.next_visit_date && c.next_visit_date >= today) list.push(c);
      }
    }
    return dedupeById(list)
      .sort((a, b) =>
        (a.next_visit_date ?? "").localeCompare(b.next_visit_date ?? ""),
      )
      .slice(0, 10);
  }, [calendarDays, today]);

  const monthTitle = monthAnchor.toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
  const weekTotal = weekDays.reduce(
    (sum, iso) => sum + (dayMap.get(iso)?.consultations.length ?? 0),
    0,
  );
  const dayConsultations = dayMap.get(selectedDate)?.consultations ?? [];

  const consForDay = (iso: string): Consultation[] =>
    dayMap.get(iso)?.consultations ?? [];

  return (
    <div className="page-stack">
      <div className="cal-header">
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>
            Расписание
          </h1>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#9095a8" }}>
            {weekTotal > 0
              ? `${weekTotal} приёмов на этой неделе`
              : "На этой неделе нет приёмов"}
          </p>
        </div>
        <div className="cal-header__controls">
          <div className="cal-view-toggle">
            <button
              type="button"
              className={`cal-view-btn ${view === "week" ? "cal-view-btn--active" : ""}`}
              onClick={() => setView("week")}
            >
              Неделя
            </button>
            <button
              type="button"
              className={`cal-view-btn ${view === "day" ? "cal-view-btn--active" : ""}`}
              onClick={() => setView("day")}
            >
              День
            </button>
          </div>
          <div className="cal-nav">
            <button
              type="button"
              className="cal-nav-btn"
              onClick={() => {
                const base = parseISODateLocal(selectedDate);
                base.setDate(base.getDate() - (view === "week" ? 7 : 1));
                setSelectedDate(toISODateLocal(base));
                setMonthAnchor(startOfMonth(base));
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M10 3L5 8l5 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className="cal-today-btn"
              onClick={() => {
                setSelectedDate(today);
                setMonthAnchor(startOfMonth(new Date()));
              }}
            >
              Сегодня
            </button>
            <button
              type="button"
              className="cal-nav-btn"
              onClick={() => {
                const base = parseISODateLocal(selectedDate);
                base.setDate(base.getDate() + (view === "week" ? 7 : 1));
                setSelectedDate(toISODateLocal(base));
                setMonthAnchor(startOfMonth(base));
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M6 3l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {err && <p className="error">{err}</p>}

      <div className="cal-layout">
        <aside className="cal-sidebar">
          {/* Mini calendar */}
          <div className="cal-mini">
            <div className="cal-mini__header">
              <button
                type="button"
                className="cal-mini-nav"
                onClick={() => setMonthAnchor((m) => addMonths(m, -1))}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M9 2L4 7l5 5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <span className="cal-mini__month">{monthTitle}</span>
              <button
                type="button"
                className="cal-mini-nav"
                onClick={() => setMonthAnchor((m) => addMonths(m, 1))}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M5 2l5 5-5 5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <div className="cal-mini__dow">
              {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="cal-mini__grid">
              {monthCells.map(({ iso, inMonth }) => {
                const has = (dayMap.get(iso)?.consultations.length ?? 0) > 0;
                const inWeek = weekDays.includes(iso);
                const isToday = iso === today;
                const isActive = iso === selectedDate;
                return (
                  <button
                    key={iso}
                    type="button"
                    className={[
                      "cal-mini__day",
                      !inMonth ? "cal-mini__day--out" : "",
                      inWeek && !isActive ? "cal-mini__day--week" : "",
                      isActive ? "cal-mini__day--active" : "",
                      isToday && !isActive ? "cal-mini__day--today" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => {
                      setSelectedDate(iso);
                      if (!inMonth)
                        setMonthAnchor(startOfMonth(parseISODateLocal(iso)));
                    }}
                  >
                    {parseISODateLocal(iso).getDate()}
                    {has && <span className="cal-mini__dot" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Upcoming */}
          <div className="cal-upcoming">
            <h3 className="cal-upcoming__title">Ближайшие визиты</h3>
            {upcoming.length === 0 ? (
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#9095a8" }}>
                Нет запланированных
              </p>
            ) : (
              <div className="cal-upcoming__list">
                {upcoming.map((c) => (
                  <Link
                    key={c.id}
                    to={`/doctor/patients/${c.patient_id}`}
                    className="cal-upcoming__item"
                  >
                    <div className="cal-upcoming__date">
                      {c.next_visit_date}
                    </div>
                    <div className="cal-upcoming__name">
                      {patientName(c.patient_id)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Main area */}
        <div className="cal-main">
          {/* WEEK VIEW */}
          {view === "week" && (
            <div className="cal-wv2">
              <div className="cal-wv2__head">
                {weekDays.map((iso) => {
                  const d = parseISODateLocal(iso);
                  const isToday = iso === today;
                  const isSel = iso === selectedDate;
                  const count = consForDay(iso).length;
                  return (
                    <button
                      key={iso}
                      type="button"
                      className={[
                        "cal-wv2__col-head",
                        isToday ? "cal-wv2__col-head--today" : "",
                        isSel ? "cal-wv2__col-head--sel" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => setSelectedDate(iso)}
                    >
                      <span className="cal-wv2__col-dow">
                        {d.toLocaleDateString("ru-RU", { weekday: "short" })}
                      </span>
                      <span
                        className={`cal-wv2__col-num ${isToday ? "cal-wv2__col-num--today" : ""}`}
                      >
                        {d.getDate()}
                      </span>
                      {count > 0 && (
                        <span className="cal-wv2__col-badge">{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="cal-wv2__body">
                {weekDays.map((iso) => {
                  const cons = consForDay(iso);
                  const isSel = iso === selectedDate;
                  return (
                    <div
                      key={iso}
                      className={`cal-wv2__col ${isSel ? "cal-wv2__col--sel" : ""}`}
                      onClick={() => setSelectedDate(iso)}
                    >
                      {cons.length === 0 ? (
                        <div className="cal-wv2__col-empty" />
                      ) : (
                        cons.map((c) => (
                          <Link
                            key={c.id}
                            to={`/doctor/patients/${c.patient_id}`}
                            className="cal-wv2__event"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="cal-wv2__event-name">
                              {patientName(c.patient_id)
                                .split(" ")
                                .slice(0, 2)
                                .join(" ")}
                            </div>
                            <div className="cal-wv2__event-time">
                              {new Date(c.visit_at).toLocaleTimeString(
                                "ru-RU",
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </div>
                            {c.next_visit_date === iso && (
                              <div className="cal-wv2__event-repeat">
                                повторный
                              </div>
                            )}
                          </Link>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* DAY VIEW */}
          {view === "day" && (
            <div className="cal-dv2">
              <div className="cal-dv2__header">
                <div>
                  <div className="cal-dv2__date">
                    {parseISODateLocal(selectedDate).toLocaleDateString(
                      "ru-RU",
                      {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      },
                    )}
                  </div>
                  <div className="cal-dv2__sub">
                    {dayConsultations.length > 0
                      ? `${dayConsultations.length} приёмов`
                      : "Нет приёмов на этот день"}
                  </div>
                </div>
                {selectedDate === today && (
                  <span className="cal-dv2__today-badge">Сегодня</span>
                )}
              </div>

              {dayConsultations.length === 0 ? (
                <div className="cal-dv2__empty">
                  <div className="cal-dv2__empty-icon">
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                      <rect
                        x="3"
                        y="5"
                        width="22"
                        height="20"
                        rx="3"
                        stroke="#d1d5e0"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M9 3v4M19 3v4M3 11h22"
                        stroke="#d1d5e0"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <p className="cal-dv2__empty-text">
                    На этот день нет приёмов
                  </p>
                </div>
              ) : (
                <div className="cal-dv2__list">
                  {dayConsultations
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(a.visit_at).getTime() -
                        new Date(b.visit_at).getTime(),
                    )
                    .map((c) => (
                      <Link
                        key={c.id}
                        to={`/doctor/patients/${c.patient_id}`}
                        className="cal-dv2__event"
                      >
                        <div className="cal-dv2__event-time-col">
                          <span className="cal-dv2__event-hour">
                            {new Date(c.visit_at).toLocaleTimeString("ru-RU", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <div className="cal-dv2__event-line" />
                        </div>
                        <div className="cal-dv2__event-card">
                          <div className="cal-dv2__event-top">
                            <div className="cal-dv2__event-avatar">
                              {patientName(c.patient_id)
                                .split(" ")
                                .slice(0, 2)
                                .map((w) => w[0])
                                .join("")}
                            </div>
                            <div className="cal-dv2__event-info">
                              <div className="cal-dv2__event-name">
                                {patientName(c.patient_id)}
                              </div>

                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: 6,
                                marginLeft: "auto",
                              }}
                            ></div>
                          </div>
                          {c.notes && (
                            <div className="cal-dv2__event-notes">
                              {c.notes}
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
