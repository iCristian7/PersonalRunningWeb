export type SyncedWorkout = {
  id: string; user_id: string; source_id: string; title: string;
  started_at: string; ended_at: string; timezone: string;
  distance_m: number | null; active_duration_s: number | null;
  hr_avg: number | null; hr_max: number | null; cadence_avg: number | null;
  elevation_gain_m: number | null; calories_kcal: number | null;
  sensations: string | null; shoe: string | null; notes: string | null;
  laps: { distance_m: number | null; duration_s: number }[] | null;
};

export function localWorkoutDate(w: SyncedWorkout): string {
  // Health Connect can supply a fixed historical UTC offset instead of an IANA timezone.
  const offset = /^([+-])(\d{2}):(\d{2})$/.exec(w.timezone);
  if (offset) {
    const minutes = (Number(offset[2]) * 60 + Number(offset[3])) * (offset[1] === '+' ? 1 : -1);
    return new Date(new Date(w.started_at).getTime() + minutes * 60000).toISOString().slice(0, 10);
  }
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: w.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(w.started_at));
  const part = (key: string) => parts.find(p => p.type === key)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function weekDates(date: string): { start: string; end: string } {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const start = d.toISOString().slice(0, 10);
  d.setUTCDate(d.getUTCDate() + 6);
  return { start, end: d.toISOString().slice(0, 10) };
}

export function weekWorkouts(rows: SyncedWorkout[], date: string): SyncedWorkout[] {
  if (!date) return [];
  const { start, end } = weekDates(date);
  return rows.filter(w => {
    const day = localWorkoutDate(w);
    return day >= start && day <= end;
  }).sort((a, b) => a.started_at.localeCompare(b.started_at));
}

const numberES = (value: number) => value.toLocaleString('es-ES', { maximumFractionDigits: 2 });
const dateES = (iso: string) => iso.split('-').reverse().join('/');
const metric = (value: number | null, unit: string) => value == null ? 'No disponible' : `${numberES(value)} ${unit}`;
export function durationLabel(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
export function paceLabel(distance: number | null, seconds: number | null): string {
  if (distance == null || distance <= 0 || seconds == null || seconds <= 0) return 'No disponible';
  const pace = Math.round(seconds / (distance / 1000));
  return `${Math.floor(pace / 60)}'${String(pace % 60).padStart(2, '0')}\"/km`;
}

export function weeklyReport(rows: SyncedWorkout[], date: string): string {
  if (!date) return '';
  const { start, end } = weekDates(date);
  const sessions = weekWorkouts(rows, date);
  if (!sessions.length) return `No hay entrenos sincronizados del ${dateES(start)} al ${dateES(end)}.`;
  const distanceKnown = sessions.filter(w => w.distance_m != null);
  const totalDistance = distanceKnown.reduce((sum, w) => sum + w.distance_m!, 0);
  const durationKnown = sessions.filter(w => w.active_duration_s != null);
  const totalDuration = durationKnown.reduce((sum, w) => sum + w.active_duration_s!, 0);
  const sections = sessions.map(w => [
    `Fecha: ${dateES(localWorkoutDate(w))}`,
    `Entreno: ${w.title}`,
    `Distancia: ${metric(w.distance_m == null ? null : w.distance_m / 1000, 'km')}`,
    `Duración activa: ${w.active_duration_s == null ? 'No disponible' : durationLabel(w.active_duration_s)}`,
    `Ritmo medio calculado (duración activa/distancia): ${paceLabel(w.distance_m, w.active_duration_s)}`,
    `FC media: ${metric(w.hr_avg, 'ppm')}`,
    `FC máxima: ${metric(w.hr_max, 'ppm')}`,
    `Cadencia: ${metric(w.cadence_avg, 'pasos/min')}`,
    `Desnivel positivo: ${metric(w.elevation_gain_m, 'm')}`,
    `Calorías: ${metric(w.calories_kcal, 'kcal')}`,
    `Sensaciones: ${w.sensations?.trim() || 'Pendiente de completar'}`,
    `Zapatillas: ${w.shoe?.trim() || 'Pendiente de completar'}`,
    ...(w.laps?.length ? [`Vueltas registradas (no necesariamente series): ${w.laps.map((lap, i) => `${i + 1} → ${metric(lap.distance_m, 'm')}, ${durationLabel(lap.duration_s)}, ${paceLabel(lap.distance_m, lap.duration_s)}`).join('; ')}`] : []),
    ...(w.notes?.trim() ? [`Notas: ${w.notes.trim()}`] : []),
  ].join('\n'));
  return [
    `Detalle entrenamientos del ${dateES(start)} al ${dateES(end)}.`,
    'Fuente: Samsung Health mediante Health Connect. Solo sesiones sincronizadas; los datos no disponibles no se estiman.',
    `Sesiones: ${sessions.length}`,
    `Distancia total conocida: ${numberES(totalDistance / 1000)} km (${distanceKnown.length}/${sessions.length} sesiones con distancia)`,
    `Duración activa total conocida: ${durationLabel(totalDuration)} (${durationKnown.length}/${sessions.length} sesiones con duración)`,
    '', sections.join('\n\n------------------------------------------\n\n'), '',
    'Analiza esta semana y propón la siguiente teniendo en cuenta mis objetivos, sensaciones y planes anteriores. Señala los datos que falten.',
  ].join('\n');
}
