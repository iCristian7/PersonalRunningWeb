export type WorkoutBlock = { name: string; tag: 'blue' | 'orange' | 'green' | 'red'; items: string[] };
export type Workout = {
  id: string;
  date: string; // YYYY-MM-DD
  dayLabel: string;
  title: string;
  objective: string;
  totalDistance: string;
  intensity: string;
  blocks: WorkoutBlock[];
  rules: string[];
  post: { title: string; items: string[] };
  meta?: { plan?: string; goal?: string; eventDate?: string };
};

export function formatDateES(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export function norm(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}
