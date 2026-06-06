export type PatientCreatePayload = {
  name: string;
  birth_date: string;
  gender: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  policy_number?: string | null;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  allergies?: string | null;
  chronic_conditions?: string | null;
  patient_notes?: string | null;
};

export type PatientUpdatePayload = Partial<{
  name: string;
  age: number;
  gender: string;
  birth_date: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  policy_number: string | null;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  allergies: string | null;
  chronic_conditions: string | null;
  patient_notes: string | null;
}>;
