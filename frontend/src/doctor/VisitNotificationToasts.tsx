import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { VisitToast } from "./useUpcomingVisitNotifications";
import { minutesUntilLabel } from "./dateUtils";

const AUTO_DISMISS_MS = 45_000;

type Props = {
  toasts: VisitToast[];
  onDismiss: (toastKey: number) => void;
};

export function VisitNotificationToasts({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div className="visit-toasts" aria-live="polite">
      {toasts.map((t) => (
        <VisitToastCard
          key={t.toastKey}
          toast={t}
          onDismiss={() => onDismiss(t.toastKey)}
        />
      ))}
    </div>
  );
}

function VisitToastCard({
  toast,
  onDismiss,
}: {
  toast: VisitToast;
  onDismiss: () => void;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    const id = window.setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [onDismiss]);

  return (
    <div className="visit-toast" role="status">
      <button
        type="button"
        className="visit-toast__close"
        aria-label="Закрыть"
        onClick={onDismiss}
      >
        ×
      </button>
      <p className="visit-toast__title">Скоро приём</p>
      <p className="visit-toast__patient">{toast.patient_name}</p>
      <p className="visit-toast__time">
        {minutesUntilLabel(toast.minutes_until)}
      </p>
      <button
        type="button"
        className="btn visit-toast__action"
        onClick={() => {
          navigate(`/doctor/patients/${toast.patient_id}`);
          onDismiss();
        }}
      >
        Открыть карту пациента
      </button>
    </div>
  );
}
