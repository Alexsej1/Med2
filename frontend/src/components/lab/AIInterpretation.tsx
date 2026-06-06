import {
  extractDisclaimer,
  parseInterpretation,
} from "./parseInterpretation";

type Props = {
  text: string;
  flaggedCount: number;
  totalCount: number;
};

export function AIInterpretation({ text, flaggedCount, totalCount }: Props) {
  const sections = parseInterpretation(text);
  const disclaimer = extractDisclaimer(text);

  return (
    <div className="ai-interpretation card card--elevated">
      <div className="ai-interpretation__header">
        <span>Интерпретация AI</span>
        <span className="ai-interpretation__stats">
          Отклонений: {flaggedCount} из {totalCount}
        </span>
      </div>

      <div className="ai-interpretation__body">
        {sections.length === 0 ? (
          <p className="ai-interpretation__fallback">{text}</p>
        ) : (
          sections.map((section) => (
            <section key={section.title} className="ai-interpretation__section">
              <h4 className="ai-interpretation__section-title">{section.title}</h4>
              {section.lines.length === 1 ? (
                <p className="ai-interpretation__paragraph">{section.lines[0]}</p>
              ) : (
                <ul className="ai-interpretation__list">
                  {section.lines.map((line) => (
                    <li key={`${section.title}-${line}`}>{line}</li>
                  ))}
                </ul>
              )}
            </section>
          ))
        )}
      </div>

      {disclaimer && (
        <div className="ai-interpretation__disclaimer">{disclaimer}</div>
      )}
    </div>
  );
}
