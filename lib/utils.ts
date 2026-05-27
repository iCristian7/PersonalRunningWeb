export type WorkoutKind = 'log' | 'plan' | 'race';
export type WorkoutBlock = { name: string; tag: 'blue' | 'orange' | 'green' | 'red'; items: string[] };
export type WorkoutMetrics = {
  distanceKm?: number;
  paceAvg?: string | null;
  hrAvg?: number | null;
  cadenceAvg?: number | null;
  elevationM?: number | null;
  workoutType?: string | null;
  notes?: string | null;
};

export type Workout = {
  id: string;
  date: string | null;
  displayDate?: string;
  kind: WorkoutKind;
  title: string;
  objective?: string;
  totalDistance?: string;
  intensity?: string;
  blocks?: WorkoutBlock[];
  rules?: string[];
  post?: { title: string; items: string[] };
  meta?: { plan?: string; goal?: string; eventDate?: string };
  metrics?: WorkoutMetrics;
};

export function isValidISODate(iso: string | null | undefined) {
  return !!iso && /^\d{4}-\d{2}-\d{2}$/.test(iso);
}

export function formatDateES(iso: string | null, fallback?: string) {
  if (!isValidISODate(iso)) return fallback ?? 'Fecha N/D';
  const [y, m, d] = iso!.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

export function sortByDateDesc(a: Workout, b: Workout) {
  const av = isValidISODate(a.date) ? a.date! : '';
  const bv = isValidISODate(b.date) ? b.date! : '';
  if (av && bv) return av < bv ? 1 : -1;
  if (av && !bv) return -1;
  if (!av && bv) return 1;
  return 0;
}
