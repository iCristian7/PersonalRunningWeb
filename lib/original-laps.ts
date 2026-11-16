export type OriginalLaps = {
  schema_version: 1;
  source: 'samsung_screenshot';
  workout_date: string;
  session_distance_m: number;
  kind: 'kilometres' | 'intervals';
  laps: { label: string; duration_s: number; distance_m: number; hr_avg?: number | null; pace_s_per_km?: number | null }[];
};

export function validateOriginalLaps(value: unknown): OriginalLaps {
  if (!value || typeof value !== 'object') throw Error('Tabla inválida.');
  const v = value as OriginalLaps;
  const finite = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  if (v.schema_version !== 1 || v.source !== 'samsung_screenshot' || !/^\d{4}-\d{2}-\d{2}$/.test(v.workout_date) ||
      !finite(v.session_distance_m,1,1e6) || !['kilometres','intervals'].includes(v.kind) || !Array.isArray(v.laps) || !v.laps.length || v.laps.length > 500)
    throw Error('Formato de tabla original no reconocido.');
  const labels = new Set<string>();
  for (const row of v.laps) {
    if (!row || typeof row.label !== 'string' || !row.label.trim() || row.label.length > 100 || labels.has(row.label) ||
        !finite(row.duration_s,0,172800) || !finite(row.distance_m,0,1e6) ||
        (row.hr_avg != null && !finite(row.hr_avg,1,300)) || (row.pace_s_per_km != null && !finite(row.pace_s_per_km,1,86400)))
      throw Error('Hay una fila inválida o repetida en la tabla.');
    labels.add(row.label);
  }
  // Displayed distances/times are rounded independently; do not force their ratios
  // or sums to equal the unrounded workout summary or displayed mean pace.
  return {
    schema_version:1,source:'samsung_screenshot',workout_date:v.workout_date,session_distance_m:v.session_distance_m,kind:v.kind,
    laps:v.laps.map(r=>({ label:r.label.trim(),duration_s:r.duration_s,distance_m:r.distance_m,
      ...(r.hr_avg != null ? {hr_avg:r.hr_avg} : {}),...(r.pace_s_per_km != null ? {pace_s_per_km:r.pace_s_per_km} : {}) })),
  };
}

export function selectOriginalLaps(value: unknown, date: string, distance: number | null): OriginalLaps {
  const values = Array.isArray(value) ? value : [value];
  if (values.length > 500) throw Error('Demasiadas tablas en el archivo.');
  const tables = values.map(validateOriginalLaps);
  const matches = tables.filter(t => t.workout_date === date && distance != null && Math.abs(t.session_distance_m-distance) <= Math.max(20,distance*.005));
  if (matches.length !== 1) throw Error('El archivo no identifica una sola tabla para la fecha y distancia de este entreno. Revisa la sesión elegida.');
  return matches[0];
}
