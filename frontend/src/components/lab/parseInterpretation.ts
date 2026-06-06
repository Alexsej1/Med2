export type InterpretationSection = {
  title: string;
  lines: string[];
};

const KNOWN_HEADERS = new Set([
  "ОБЩАЯ КАРТИНА",
  "ОТКЛОНЕНИЯ",
  "РЕКОМЕНДАЦИИ",
  "РЕКОМЕНДАЦИИ ВРАЧУ",
  "НА ЧТО ОБРАТИТЬ ВНИМАНИЕ",
  "НА ЧТО ОБРАТИТЬ ВНИМАНИЕ ВРАЧУ",
  "НОРМА",
  "ПОКАЗАТЕЛИ В НОРМЕ",
]);

const DISCLAIMER_RE = /⚠️[\s\S]*$/;

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "$1")
    .replace(/^#+\s*/, "")
    .trim();
}

function normalizeHeader(line: string): string | null {
  const cleaned = stripMarkdown(line.replace(/^\d+\.\s*/, "").trim());
  const upper = cleaned.toUpperCase();
  if (KNOWN_HEADERS.has(upper)) return upper;
  return null;
}

function splitBody(text: string): string {
  const match = text.match(DISCLAIMER_RE);
  return match ? text.slice(0, match.index).trim() : text.trim();
}

export function extractDisclaimer(text: string): string | null {
  const match = text.match(DISCLAIMER_RE);
  return match ? match[0].trim() : null;
}

export function parseInterpretation(text: string): InterpretationSection[] {
  const body = splitBody(text);
  if (!body) return [];

  const sections: InterpretationSection[] = [];
  let current: InterpretationSection | null = null;

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const header = normalizeHeader(line);
    if (header) {
      current = { title: header, lines: [] };
      sections.push(current);
      continue;
    }

    const content = stripMarkdown(line.replace(/^[-•—]\s*/, ""));
    if (!content) continue;

    if (!current) {
      current = { title: "ЗАКЛЮЧЕНИЕ", lines: [] };
      sections.push(current);
    }
    current.lines.push(content);
  }

  return sections.filter((s) => s.lines.length > 0); // ← добавь эту строку
}
