import type {
  PatientCreatePayload,
  PatientUpdatePayload,
} from "./patientFormTypes";
import type {
  CalendarDay,
  Consultation,
  DiagnoseResponse,
  DiseaseSuggestion,
  DoctorSummary,
  LabAnalysis,
  LabAnalysisListItem,
  Patient,
  UpcomingNotification,
  User,
} from "./types";

const jsonHeaders = { "Content-Type": "application/json" };

async function request<T>(
  path: string,
  opts: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string>),
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(path, { ...opts, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body?.detail)
        detail =
          typeof body.detail === "string"
            ? body.detail
            : JSON.stringify(body.detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function fetchConsultationPdf(
  token: string,
  id: number,
): Promise<Blob> {
  const res = await fetch(`/api/consultations/${id}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body?.detail)
        detail =
          typeof body.detail === "string"
            ? body.detail
            : JSON.stringify(body.detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.blob();
}

export async function fetchLabAnalysisPdf(
  token: string,
  id: number,
): Promise<Blob> {
  const res = await fetch(`/api/lab-analyses/${id}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body?.detail)
        detail =
          typeof body.detail === "string"
            ? body.detail
            : JSON.stringify(body.detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.blob();
}

export const api = {
  login(username: string, password: string) {
    return request<{ access_token: string; token_type: string }>(
      "/api/auth/login",
      {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ username, password }),
      },
    );
  },
  me(token: string) {
    return request<User>("/api/auth/me", { token });
  },
  patients(token: string, params?: { doctorId?: number; q?: string }) {
    const sp = new URLSearchParams();
    if (params?.doctorId != null) sp.set("doctor_id", String(params.doctorId));
    if (params?.q) sp.set("q", params.q);
    const qs = sp.toString();
    return request<Patient[]>(`/api/patients${qs ? `?${qs}` : ""}`, { token });
  },
  patient(token: string, id: number) {
    return request<Patient>(`/api/patients/${id}`, { token });
  },
  updatePatient(token: string, id: number, body: PatientUpdatePayload) {
    return request<Patient>(`/api/patients/${id}`, {
      method: "PATCH",
      token,
      headers: jsonHeaders,
      body: JSON.stringify(body),
    });
  },
  createPatient(token: string, body: PatientCreatePayload) {
    return request<Patient>("/api/patients", {
      method: "POST",
      token,
      headers: jsonHeaders,
      body: JSON.stringify(body),
    });
  },
  consultations(token: string, patientId?: number) {
    const q = patientId != null ? `?patient_id=${patientId}` : "";
    return request<Consultation[]>(`/api/consultations${q}`, { token });
  },
  consultation(token: string, id: number) {
    return request<Consultation>(`/api/consultations/${id}`, { token });
  },
  consultationPdf(token: string, id: number) {
    return fetchConsultationPdf(token, id);
  },
  createConsultation(
    token: string,
    body: {
      patient_id: number;
      visit_at?: string | null;
      next_visit_date?: string | null;
      notes?: string | null;
      symptom_keys: string[];
      clarifications?: { symptom_key: string; present: boolean }[] | null;
      diagnoses: Record<string, unknown>;
      diagnosis_feedback?: boolean | null;
    },
  ) {
    return request<Consultation>("/api/consultations", {
      method: "POST",
      token,
      headers: jsonHeaders,
      body: JSON.stringify(body),
    });
  },
  feedback(token: string, id: number, diagnosis_feedback: boolean) {
    return request<Consultation>(`/api/consultations/${id}/feedback`, {
      method: "PATCH",
      token,
      headers: jsonHeaders,
      body: JSON.stringify({ diagnosis_feedback }),
    });
  },
  calendar(token: string, start?: string, end?: string) {
    const p = new URLSearchParams();
    if (start) p.set("start", start);
    if (end) p.set("end", end);
    const q = p.toString();
    return request<CalendarDay[]>(`/api/calendar${q ? `?${q}` : ""}`, {
      token,
    });
  },
  doctorSummary(token: string) {
    return request<DoctorSummary>("/api/doctor/summary", { token });
  },
  upcomingNotifications(token: string) {
    return request<UpcomingNotification[]>("/api/notifications/upcoming", {
      token,
    });
  },
  symptomLabels(token: string) {
    return request<Record<string, string>>("/api/symptoms/labels", { token });
  },
  symptoms(token: string, q: string) {
    return request<{ key: string; label: string }[]>(
      `/api/symptoms/autocomplete?q=${encodeURIComponent(q)}`,
      {
        token,
      },
    );
  },
  diseases(token: string, q: string) {
    return request<DiseaseSuggestion[]>(
      `/api/diseases/autocomplete?q=${encodeURIComponent(q)}`,
      { token },
    );
  },
  diagnose(
    token: string,
    body: {
      symptom_keys: string[];
      clarifications?: { symptom_key: string; present: boolean }[] | null;
    },
  ) {
    return request<DiagnoseResponse>("/api/diagnose", {
      method: "POST",
      token,
      headers: jsonHeaders,
      body: JSON.stringify(body),
    });
  },
  adminDoctors(token: string) {
    return request<
      {
        id: number;
        username: string;
        full_name: string | null;
        patients_count: number;
      }[]
    >("/api/admin/doctors", { token });
  },
  adminCreateDoctor(
    token: string,
    body: { username: string; password: string; full_name?: string | null },
  ) {
    return request<{
      id: number;
      username: string;
      full_name: string | null;
      patients_count: number;
    }>("/api/admin/doctors", {
      method: "POST",
      token,
      headers: jsonHeaders,
      body: JSON.stringify(body),
    });
  },
  adminCreateConsultation(
    token: string,
    body: {
      patient_id: number;
      doctor_id: number;
      visit_at?: string | null;
      next_visit_date?: string | null;
      notes?: string | null;
      symptom_keys: string[];
      clarifications?: unknown;
      diagnoses: Record<string, unknown>;
      diagnosis_feedback?: boolean | null;
    },
  ) {
    return request<Consultation>("/api/admin/consultations", {
      method: "POST",
      token,
      headers: jsonHeaders,
      body: JSON.stringify(body),
    });
  },
  adminDeleteConsultation(token: string, id: number) {
    return request<{ ok: boolean }>(`/api/admin/consultations/${id}`, {
      method: "DELETE",
      token,
    });
  },
  labAnalyses(token: string, patientId: number) {
    return request<LabAnalysisListItem[]>(
      `/api/lab-analyses?patient_id=${patientId}`,
      { token },
    );
  },
  labAnalysis(token: string, id: number) {
    return request<LabAnalysis>(`/api/lab-analyses/${id}`, { token });
  },
  labAnalysisPdf(token: string, id: number) {
    return fetchLabAnalysisPdf(token, id);
  },
  async uploadLabAnalysis(token: string, patientId: number, file: File) {
    const form = new FormData();
    form.append("patient_id", String(patientId));
    form.append("file", file);
    const res = await fetch("/api/lab-analyses", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = await res.json();
        if (body?.detail)
          detail =
            typeof body.detail === "string"
              ? body.detail
              : JSON.stringify(body.detail);
      } catch {
        /* ignore */
      }
      throw new Error(detail);
    }
    return (await res.json()) as LabAnalysis;
  },
};
