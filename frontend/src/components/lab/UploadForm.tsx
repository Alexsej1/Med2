import { DragEvent, FormEvent, useRef, useState } from "react";

type Props = {
  disabled?: boolean;
  onUpload: (file: File) => Promise<void>;
};

export function UploadForm({ disabled, onUpload }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      await onUpload(file);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    setFile(f);
    setError(null);
  }

  return (
    <form onSubmit={handleSubmit} className="card card--elevated lab-upload">
      <h3 className="ppd-section-title">Загрузить анализ</h3>
      <p className="muted lab-page__hint" style={{ marginTop: 0 }}>
        Инструмент-помощник для врача. Не заменяет клиническое решение.
      </p>
      <div
        className={`lab-upload__zone ${dragOver ? "lab-upload__zone--over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp"
          className="lab-upload__input"
          disabled={disabled || loading}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError(null);
          }}
        />
        <p className="lab-upload__title">
          PDF или фото бланка (JPG, PNG, WebP)
        </p>
        {file && <p className="muted">Выбран: {file.name}</p>}
      </div>
      <div className="btn-row">
        <button
          type="submit"
          className="btn"
          disabled={!file || loading || disabled}
        >
          {loading ? "Анализирую…" : "Отправить на анализ"}
        </button>
      </div>
      {error && <p className="error-banner">{error}</p>}
    </form>
  );
}
