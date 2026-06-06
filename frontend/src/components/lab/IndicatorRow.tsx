import type { LabIndicator } from "../../types";

const STATUS_CONFIG: Record<
  string,
  { color: string; icon: string; label: string }
> = {
  normal: { color: "green", icon: "✓", label: "норма" },
  low: { color: "orange", icon: "↓", label: "понижен" },
  high: { color: "orange", icon: "↑", label: "повышен" },
  critical_low: { color: "red", icon: "↓↓", label: "критически низкий" },
  critical_high: { color: "red", icon: "↑↑", label: "критически высокий" },
  unknown: { color: "gray", icon: "?", label: "не определено" },
};

function formatRef(ind: LabIndicator): string {
  if (ind.ref_min != null && ind.ref_max != null) {
    return `${ind.ref_min} – ${ind.ref_max}${ind.unit ? ` ${ind.unit}` : ""}`;
  }
  if (ind.ref_min != null)
    return `≥ ${ind.ref_min}${ind.unit ? ` ${ind.unit}` : ""}`;
  if (ind.ref_max != null)
    return `≤ ${ind.ref_max}${ind.unit ? ` ${ind.unit}` : ""}`;
  return "—";
}

export function IndicatorRow({ indicator }: { indicator: LabIndicator }) {
  const cfg = STATUS_CONFIG[indicator.status] ?? STATUS_CONFIG.unknown;
  const dev =
    indicator.deviation_pct != null
      ? `${indicator.deviation_pct > 0 ? "+" : ""}${indicator.deviation_pct}%`
      : null;

  return (
    <div className={`indicator-row indicator-row--${cfg.color}`}>
      <span className="indicator-row__icon" aria-hidden>
        {cfg.color === "red" ? "🔴" : cfg.color === "orange" ? "🟠" : "🟢"}{" "}
        {cfg.icon}
      </span>
      <span className="indicator-row__name">
        {indicator.name}
        {indicator.name_en ? (
          <span className="indicator-row__en muted">
            {" "}
            ({indicator.name_en})
          </span>
        ) : null}
      </span>
      <span className="indicator-row__value">
        {indicator.value} {indicator.unit ?? ""}
      </span>
      <span className="indicator-row__ref">норма: {formatRef(indicator)}</span>
      <span className="indicator-row__status">{cfg.label}</span>
      {dev && indicator.status !== "normal" && (
        <span className="indicator-row__dev">{dev}</span>
      )}
    </div>
  );
}
