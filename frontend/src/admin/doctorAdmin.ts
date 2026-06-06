export type AdminDoctor = {
  id: number;
  username: string;
  full_name: string | null;
  patients_count: number;
};

export function doctorDisplayName(
  doctorId: number,
  doctors: Pick<AdminDoctor, "id" | "username" | "full_name">[],
): string {
  const d = doctors.find((x) => x.id === doctorId);
  if (!d) return `врач #${doctorId}`;
  const name = d.full_name?.trim();
  return name || d.username;
}
