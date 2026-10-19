export type SyncedWorkout = {
  id: string; user_id: string; source_id: string; title: string;
  started_at: string; ended_at: string; timezone: string;
  distance_m: number | null; active_duration_s: number | null;
  hr_avg: number | null; hr_max: number | null; cadence_avg: number | null;
  elevation_gain_m: number | null; calories_kcal: number | null;
  sensations: string | null; shoe: string | null; notes: string | null;
  source_notes?: string | null;
  elapsed_duration_s?: number | null;
  sync_details?: {
    provider?: string; samsung_id?: string; samsung_mean_speed_mps?: number | null;
    pace_avg_s_per_km?: number | null; lap_source?: string;
    duration_basis?: string; pause_segments?: number;
    cadence_status?: string; cadence_samples?: number;
    elevation_status?: string; elevation_records?: number;
    notes_status?: string; lap_count?: number;
  } | null;
  laps: { distance_m: number | null; duration_s: number; active_duration_s?: number | null; started_at?: string; ended_at?: string }[] | null;
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
export function durationBasisLabel(w: SyncedWorkout): string {
  if (w.sync_details?.provider === 'samsung_sdk') return 'Duración original de Samsung Health';
  return w.sync_details?.duration_basis === 'session_pause_segments'
    ? 'Duración descontando pausas compartidas'
    : 'Duración Health Connect (pausas no verificadas)';
}
export function availabilityLabel(status: string | undefined): string {
  if (status === 'not_exposed_by_sdk') return 'no facilitado por el SDK de Samsung Health';
  if (status === 'permission_denied') return 'permiso no concedido; revísalo en Health Connect';
  if (status === 'not_shared') return 'sin registros compartidos por Samsung Health en Health Connect';
  return 'no disponible en esta sincronización';
}
export function lapReport(w: SyncedWorkout): string[] {
  if (!w.laps?.length) return [w.sync_details?.provider === 'samsung_sdk' ? 'Vueltas: el SDK de Samsung no expone vueltas de running y no se han recibido de Health Connect.' : 'Vueltas: no compartidas en esta sincronización; no se generan vueltas ficticias.'];
  return ['Vueltas registradas (no necesariamente series):', 'Fuente de las vueltas: Health Connect; el ritmo de cada vuelta es calculado.', ...w.laps.map((lap, i) => {
    const active = lap.active_duration_s;
    const seconds = active ?? lap.duration_s;
    return `Vuelta ${i + 1}: distancia ${metric(lap.distance_m, 'm')}; tiempo transcurrido ${durationLabel(lap.duration_s)}` +
      (active != null ? `; tiempo descontando pausas compartidas ${durationLabel(active)}` : '') +
      `; ritmo medio calculado ${paceLabel(lap.distance_m, seconds)} (${active != null ? 'descontando pausas compartidas' : 'tiempo transcurrido; pausas no verificadas'})`;
  })];
}
export function durationLabel(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
export function paceLabel(distance: number | null, seconds: number | null): string {
  if (distance == null || distance <= 0 || seconds == null || seconds <= 0) return 'No disponible';
  const pace = Math.round(seconds / (distance / 1000));
  return `${Math.floor(pace / 60)}'${String(pace % 60).padStart(2, '0')}\"/km`;
}

export function workoutPace(w: SyncedWorkout): { value: string; basis: string } {
  const speed = w.sync_details?.samsung_mean_speed_mps;
  if (w.sync_details?.provider === 'samsung_sdk' && typeof speed === 'number' && Number.isFinite(speed) && speed > 0) {
    return { value: paceLabel(1000, 1000 / speed), basis: 'a partir de la velocidad media original de Samsung Health' };
  }
  return { value: paceLabel(w.distance_m, w.active_duration_s), basis: w.sync_details?.provider === 'samsung_sdk'
    ? 'calculado con duración y distancia originales de Samsung; velocidad media no disponible'
    : 'calculado con duración importada y distancia; no es el valor original de Samsung' };
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
    `Origen de las métricas: ${w.sync_details?.provider === 'samsung_sdk' ? 'Samsung Health Data SDK (lectura directa)' : 'Health Connect'}`,
    `Distancia: ${metric(w.distance_m == null ? null : w.distance_m / 1000, 'km')}`,
    `Tiempo transcurrido de la sesión: ${durationLabel(w.elapsed_duration_s ?? (new Date(w.ended_at).getTime() - new Date(w.started_at).getTime()) / 1000)}`,
    `${durationBasisLabel(w)}: ${w.active_duration_s == null ? 'No disponible' : durationLabel(w.active_duration_s)}`,
    `Ritmo medio (${workoutPace(w).basis}): ${workoutPace(w).value}`,
    `FC media: ${metric(w.hr_avg, 'ppm')}`,
    `FC máxima: ${metric(w.hr_max, 'ppm')}`,
    `Cadencia: ${metric(w.cadence_avg, 'pasos/min')}`,
    ...(w.cadence_avg == null ? [`Cadencia ausente: ${availabilityLabel(w.sync_details?.cadence_status)}.`] : w.sync_details?.cadence_status === 'sample_mean' ? ['Cadencia calculada: media de las muestras compartidas; puede diferir de la media de Samsung.'] : []),
    `Desnivel positivo: ${metric(w.elevation_gain_m, 'm')}`,
    ...(w.elevation_gain_m == null ? [`Desnivel ausente: ${availabilityLabel(w.sync_details?.elevation_status)}.`] : []),
    `Calorías: ${metric(w.calories_kcal, 'kcal')}`,
    `Sensaciones: ${w.sensations?.trim() || 'Pendiente de completar'}`,
    `Zapatillas: ${w.shoe?.trim() || 'Pendiente de completar'}`,
    ...lapReport(w),
    `Notas de Samsung Health: ${w.source_notes?.trim() || 'No compartidas en esta sincronización'}`,
    ...(w.notes?.trim() ? [`Notas adicionales: ${w.notes.trim()}`] : []),
  ].join('\n'));
  return [
    `Detalle entrenamientos del ${dateES(start)} al ${dateES(end)}.`,
    'Datos de Samsung Health. Se indica la fuente de cada entreno y la base del ritmo. Los datos no disponibles no se inventan.',
    `Sesiones: ${sessions.length}`,
    `Distancia total conocida: ${numberES(totalDistance / 1000)} km (${distanceKnown.length}/${sessions.length} sesiones con distancia)`,
    `Duración importada total conocida: ${durationLabel(totalDuration)} (${durationKnown.length}/${sessions.length} sesiones con duración; revisar la base de tiempos de cada entreno)`,
    '', sections.join('\n\n------------------------------------------\n\n'), '',
    'Analiza esta semana y propón la siguiente teniendo en cuenta mis objetivos, sensaciones y planes anteriores. Señala los datos que falten.',
  ].join('\n');
}
