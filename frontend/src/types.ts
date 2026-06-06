export type UserRole = "doctor" | "admin";

export type User = {
  id: number;
  username: string;
  role: UserRole;
  full_name: string | null;
};

export type Patient = {
  id: number;
  doctor_id: number;
  name: string;
  age: number;
  gender: string;
  created_at: string;
  phone?: string | null;
  email?: string | null;
  birth_date?: string | null;
  address?: string | null;
  policy_number?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  allergies?: string | null;
  chronic_conditions?: string | null;
  patient_notes?: string | null;
};

export type Consultation = {
  id: number;
  patient_id: number;
  doctor_id: number;
  visit_at: string;
  next_visit_date: string | null;
  notes: string | null;
  symptoms_json: string[] | null;
  clarifications_json: unknown;
  diagnoses_json: Record<string, unknown> | null;
  diagnosis_feedback: boolean | null;
  created_at: string;
};

export type DiagnosisItem = {
  disease: string;
  probability: number;
  symptom_influences: {
    symptom_key: string;
    symptom_label: string;
    weight: number;
  }[];
  icd10_code?: string | null;
  icd10_title_ru?: string | null;
  icd10_title_en?: string | null;
};

export type DiseaseSuggestion = {
  name: string;
  icd10_code?: string;
  icd10_title_ru?: string;
  icd10_title_en?: string;
};

export type DiagnoseResponse = {
  predictions: DiagnosisItem[];
  needs_clarification: boolean;
  clarifying_questions: {
    symptom_key: string;
    symptom_label: string;
    hint: string;
  }[];
  max_probability: number;
};

export type CalendarDay = {
  date: string;
  consultations: Consultation[];
};

export type DoctorSummary = {
  patients_total: number;
  consultations_total: number;
  consultations_last_7_days: number;
  upcoming_visits: {
    consultation_id: number;
    patient_id: number;
    patient_name: string;
    next_visit_date: string;
  }[];
};

export type UpcomingNotification = {
  consultation_id: number;
  patient_id: number;
  patient_name: string;
  next_visit_date: string;
  minutes_until: number;
};

export type LabIndicator = {
  id?: number;
  name: string;
  name_en?: string | null;
  value: number;
  unit: string | null;
  ref_min: number | null;
  ref_max: number | null;
  status:
    | "normal"
    | "low"
    | "high"
    | "critical_low"
    | "critical_high"
    | "unknown";
  deviation_pct: number | null;
};

export type LabAnalysisListItem = {
  id: number;
  patient_id: number;
  original_filename: string;
  test_type: string | null;
  test_date: string | null;
  uploaded_at: string;
  flagged_count: number;
  total_count: number;
  status: string;
};

export type LabAnalysis = {
  id: number;
  patient_id: number;
  doctor_id: number;
  original_filename: string;
  mime_type: string;
  test_type: string | null;
  test_date: string | null;
  lab_name: string | null;
  extracted_json: Record<string, unknown> | null;
  ai_interpretation: string | null;
  flagged_count: number;
  total_count: number;
  status: string;
  indicators: LabIndicator[];
  created_at: string;
};
