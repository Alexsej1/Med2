import { Link, Navigate } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { BRAND_FULL, BRAND_LEGAL, BRAND_SHORT } from "../brand";
import { useAuth } from "../AuthContext";

export function LandingPage() {
  const { user, loading } = useAuth();
  if (!loading && user) {
    return (
      <Navigate to={user.role === "admin" ? "/admin" : "/doctor"} replace />
    );
  }

  return (
    <div className="landing">
      {/* ── NAV ── */}
      <header className="landing-header motion-header">
        <Link to="/" className="landing-header__brand">
          <BrandMark />
        </Link>
        <nav className="landing-header__nav">
          <a href="#stats">О системе</a>
          <a href="#services">Возможности</a>
          <a href="#about">Подход</a>
          <Link to="/login" className="btn btn--small landing-header__cta">
            Войти
          </Link>
        </nav>
      </header>

      {/* ── HERO (твой текущий hero остаётся здесь) ── */}
      <div className="lhero">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <h1 className="lhero__title">
            Med<em>Expert</em>
          </h1>
          <p
            style={{
              fontWeight: 800,
              fontSize: "clamp(1rem, 2vw, 1.4rem)",
              letterSpacing: "0.05em",
              color: "#0a0e1a",
            }}
          >
            МЕДИЦИНСКАЯ СИСТЕМА
          </p>
        </div>

        <div className="lhero__card">
          <div className="lhero__card-left">
            <p className="lhero__card-caption">
              Умный приём,
              <br />
              каждый день
            </p>
            <div className="lhero__card-stat">
              <span className="lhero__card-stat-num">500+</span>
              <span className="lhero__card-stat-label">
                Пациентов в картотеке
              </span>
            </div>
          </div>
          <div className="lhero__card-visual">
            <div className="lhero__preview">
              <div className="lhero__preview-header">
                <div className="lhero__preview-avatar">АК</div>
                <div>
                  <div className="lhero__preview-name">Ковалёва А. С.</div>
                  <div className="lhero__preview-sub">38 лет · женский</div>
                </div>
              </div>
              <div className="lhero__preview-row">
                <span className="lhero__preview-tag">кашель</span>
                <span className="lhero__preview-tag">температура</span>
                <span className="lhero__preview-tag">слабость</span>
              </div>
              <div className="lhero__preview-diag">
                <div className="lhero__preview-diag-label">ИИ-диагноз</div>
                <div className="lhero__preview-diag-name">ОРВИ</div>
                <div className="lhero__preview-bar">
                  <div className="lhero__preview-bar-track">
                    <div
                      className="lhero__preview-bar-fill"
                      style={{ width: "77%" }}
                    />
                  </div>
                  <span className="lhero__preview-bar-pct">77%</span>
                </div>
              </div>
              <div className="lhero__preview-btn">Сохранить консультацию</div>
            </div>
          </div>
          <div className="lhero__card-right">
            <p className="lhero__card-desc">
              Полная история пациента, ИИ-подсказки при диагностике и удобный
              календарь приёмов — всё в одной системе.
            </p>
            <Link to="/login" className="lhero__card-btn">
              Войти в кабинет
              <span className="lhero__card-btn-arrow">→</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── STATS ── */}
      <section id="stats" className="lsection lsection--white">
        <div className="lstats">
          <div className="lstats__head">
            <p className="lstats__eyebrow">Система в цифрах</p>
            <h2 className="lstats__title">
              Всё под контролем,
              <br />
              каждый приём
            </h2>
          </div>
          <div className="lstats__grid">
            <div className="lstats__card">
              <span className="lstats__num">500+</span>
              <span className="lstats__label">пациентов в картотеке</span>
            </div>
            <div className="lstats__card">
              <span className="lstats__num">50+</span>
              <span className="lstats__label">симптомов для диагностики</span>
            </div>
            <div className="lstats__card">
              <span className="lstats__num">49</span>
              <span className="lstats__label">заболеваний в базе ИИ</span>
            </div>
            <div className="lstats__card lstats__card--blue">
              <span className="lstats__num">ИИ</span>
              <span className="lstats__label">
                диагностика с высокой вероятностью
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section id="services" className="lsection lsection--gray">
        <div className="lservices">
          <div className="lservices__left">
            <p className="lservices__eyebrow">Возможности</p>
            <h2 className="lservices__title">
              Всё для
              <br />
              качественного
              <br />
              приёма
            </h2>
            <p className="lservices__desc">
              Каждый инструмент создан чтобы врач тратил меньше времени на
              рутину и больше — на пациента.
            </p>
            <Link to="/login" className="lservices__btn">
              Начать работу →
            </Link>
          </div>
          <div className="lservices__grid">
            <div className="lservices__card">
              <div className="lservices__icon"></div>
              <h3>Карта пациента</h3>
              <p>
                Контакты, анамнез, аллергии и полная история визитов в одном
                месте.
              </p>
            </div>
            <div className="lservices__card">
              <div className="lservices__icon"></div>
              <h3>ИИ-диагностика</h3>
              <p>
                Система анализирует симптомы и предлагает диагноз с уровнем
                уверенности.
              </p>
            </div>
            <div className="lservices__card">
              <div className="lservices__icon"></div>
              <h3>Расписание</h3>
              <p>
                Календарь приёмов и напоминания о повторных визитах пациентов.
              </p>
            </div>
            <div className="lservices__card">
              <div className="lservices__icon"></div>
              <h3>Аналитика</h3>
              <p>
                Статистика приёмов, обратная связь по диагнозам и журнал
                консультаций.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section id="about" className="lsection lsection--white">
        <div className="labout">
          <div className="labout__visual">
            <div className="labout__visual-card labout__visual-card--1">
              <div className="labout__mini-stat">
                <span>12</span>
                <small>консультаций сегодня</small>
              </div>
            </div>
            <div className="labout__visual-card labout__visual-card--2">
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "#5a6078",
                  marginBottom: 6,
                }}
              >
                СЛЕДУЮЩИЙ ВИЗИТ
              </div>
              <div
                style={{ fontWeight: 800, fontSize: "1rem", color: "#0a0e1a" }}
              >
                Петрова Е. И.
              </div>
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "#4E67EB",
                  fontWeight: 600,
                  marginTop: 4,
                }}
              >
                Завтра, 10:00
              </div>
            </div>
            <div className="labout__visual-bg" />
          </div>

          <div className="labout__text">
            <h2 className="labout__title">
              Создано для врачей
            </h2>
            <p className="labout__desc">
              {BRAND_FULL} — это рабочее место врача без лишнего. Всё что нужно
              для приёма: карта пациента, диагностика, расписание и заметки в
              одном окне.
            </p>
            <ul className="labout__list">
              <li>Заполнение карты за 2 минуты</li>
              <li>ИИ-подсказки при неясном диагнозе</li>
              <li>Автоматические напоминания о визитах</li>
              <li>Совместная работа врача и регистратуры</li>
            </ul>
            <Link to="/login" className="labout__btn">
              Попробовать систему →
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="lcta">
        <div className="lcta__inner">
          <h2 className="lcta__title">
            Готовы упростить
            <br />
            ведение приёма?
          </h2>
          <p className="lcta__desc">{BRAND_LEGAL}</p>
          <Link to="/login" className="lcta__btn">
            Войти в кабинет →
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lfooter">
        <div className="lfooter__inner">
          <BrandMark compact />
          <span className="lfooter__copy">
            © {new Date().getFullYear()} {BRAND_FULL}
          </span>
          <Link to="/login" className="lfooter__link">
            Войти в систему →
          </Link>
        </div>
        <p className="lfooter__fine">
          Учебный / демонстрационный контур. Не для реальной медицинской
          документации.
        </p>
      </footer>
    </div>
  );
}
