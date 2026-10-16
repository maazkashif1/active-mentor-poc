/** Display name for a prescription — prefers API `exerciseName`. */
export function exerciseDisplayName(prescriptionOrId?: {
  exerciseId?: string;
  exerciseName?: string;
} | string | null): string {
  if (!prescriptionOrId) return 'Exercise';
  if (typeof prescriptionOrId === 'string') {
    return prescriptionOrId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  if (prescriptionOrId.exerciseName?.trim()) return prescriptionOrId.exerciseName.trim();
  const id = prescriptionOrId.exerciseId;
  if (!id) return 'Exercise';
  return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
