import test from 'node:test';
import assert from 'node:assert/strict';
import { localWorkoutDate, weekDates, weekWorkouts, weeklyReport, paceLabel, workoutPace, lapReport, splitDiagnostics } from '../lib/weekly-report.ts';

const session = (overrides = {}) => ({
  id: 'id', user_id: 'owner', source_id: 'health-id', title: 'Running',
  started_at: '2026-09-14T08:00:00Z', ended_at: '2026-09-14T09:00:00Z', timezone: 'Atlantic/Canary',
  distance_m: 8000, active_duration_s: 3800, hr_avg: 146, hr_max: 165,
  cadence_avg: 166, elevation_gain_m: 38, calories_kcal: null,
  sensations: 'buenas', shoe: 'Trail', notes: null, laps: null, ...overrides,
});

test('elapsed kilometre splits disclose time basis and estimated edges in the report', () => {
  const text = weeklyReport([session({ sync_details: {
    report_include_estimates:true, km_split_status: 'calculated', km_split_time_basis: 'elapsed_time', km_split_edge_estimated_s: 10,
    km_splits: [{ distance_m: 1000, duration_s: 500, hr_avg: 145, partial: false }],
  } })], '2026-09-16');
  assert.match(text, /Tiempo de los parciales: transcurrido/);
  assert.match(text, /Se estiman 10 s en los extremos/);
  assert.match(text, /Km 1:.*8'20.*FC media estimada 145 ppm/);
});

test('user-defined time blocks replace kilometre rows without exporting raw trace', () => {
  const text = weeklyReport([session({ distance_m:2000, elapsed_duration_s:1000, active_duration_s:1000, sync_details:{
    report_include_estimates:true, exercise_trace:Array.from({length:1001},(_,t)=>[t,2,150]),
    analysis_config:{ mode:'intervals',clock:'observed',blocks:[{label:'Trabajo 1',basis:'time',value:480},{label:'Recuperación 1',basis:'time',value:120}] },
    km_split_status:'calculated',km_splits:[{distance_m:1000,duration_s:500,partial:false}],
  } })], '2026-09-16');
  assert.match(text,/estructura indicada por el usuario/);
  assert.match(text,/Trabajo 1: distancia estimada 960 m; tiempo 0:08:00; ritmo medio estimado 8'20.*FC media estimada 150 ppm/);
  assert.match(text,/Recuperación 1: distancia estimada 240 m/);
  assert.doesNotMatch(text,/Km 1:|exercise_trace/);
});

test('observed-time kilometre report retains the inferred-pause disclosure', () => {
  const text = lapReport(session({sync_details:{km_split_status:'calculated',km_split_time_basis:'observed_time_inferred_pauses',km_split_gap_s:300,km_splits:[{distance_m:1000,duration_s:500,partial:false}]}})).join('\n');
  assert.match(text,/pausas inferidas/);
  assert.match(text,/margen temporal 2 %/);
  assert.match(text,/0:05:00/);
});

test('sync diagnostics show edge gaps separately from the clean ChatGPT report', () => {
  const row = session({ sync_details: { reader_version: '0.6.0', km_split_status: 'incomplete_edges',
    km_split_start_gap_s: 45, km_split_end_gap_s: 2, km_split_log_count: 100 } });
  const diagnostic = splitDiagnostics(row).join('\n');
  assert.match(diagnostic, /0.6.0/);
  assert.match(diagnostic, /45 s al inicio y 2 s al final/);
  assert.match(diagnostic, /Muestras recibidas: 100/);
  assert.doesNotMatch(weeklyReport([row], '2026-09-16'), /incomplete_edges|45 s al inicio|no calculados|No disponible/);
});

test('kilometre splits retain different paces and label the partial kilometre as estimated', () => {
  const text = lapReport(session({ distance_m: 2500, sync_details: {
    km_split_status: 'calculated', km_split_integrated_m: 2490, km_split_gap_s: 60,
    km_splits: [{ distance_m: 1000, duration_s: 400, partial: false },
      { distance_m: 1000, duration_s: 350, partial: false },
      { distance_m: 500, duration_s: 180, partial: true }],
  } })).join('\n');
  assert.match(text, /aproximados por kilómetro/);
  assert.match(text, /Km 1:.*6'40/);
  assert.match(text, /Km 2:.*5'50/);
  assert.match(text, /Tramo final 3: 500 m;.*6'00/);
  assert.match(text, /se ajusta proporcionalmente/);
  assert.match(text, /pausas inferidas/);
  assert.match(text, /No es una confirmación/);
});

test('failed reconstruction explains missing splits and preserves original laps', () => {
  const text = lapReport(session({ sync_details: { km_split_status: 'duration_mismatch' },
    laps: [{ distance_m: 1000, duration_s: 300 }] })).join('\n');
  assert.match(text, /no coincide suficientemente/);
  assert.match(text, /Vuelta 1/);
  assert.doesNotMatch(text, /Km 1:/);
  assert.match(lapReport(session({ sync_details: { km_split_status: 'no_speed_samples' } })).join('\n'), /suficientes muestras de velocidad/);
});

test('week boundaries cover Monday through Sunday across years', () => {
  assert.deepEqual(weekDates('2027-01-01'), { start: '2026-12-28', end: '2027-01-03' });
  assert.deepEqual(weekDates('2026-09-20'), { start: '2026-09-14', end: '2026-09-20' });
});
test('week membership uses the historical local date, not the UTC date', () => {
  const localMonday = session({ started_at: '2026-09-13T23:30:00Z' });
  const followingMonday = session({ id: 'next', started_at: '2026-09-20T23:30:00Z' });
  assert.equal(localWorkoutDate(localMonday), '2026-09-14');
  assert.deepEqual(weekWorkouts([followingMonday, localMonday], '2026-09-16').map(w => w.id), ['id']);
});
test('Health Connect fixed UTC offsets retain the original session date', () => {
  assert.equal(localWorkoutDate(session({ started_at: '2026-09-14T00:30:00Z', timezone: '-03:30' })), '2026-09-13');
  assert.equal(localWorkoutDate(session({ started_at: '2026-09-13T23:30:00Z', timezone: '+01:00' })), '2026-09-14');
});
test('pace rounding carries seconds into minutes', () => {
  assert.equal(paceLabel(1000, 359.6), '6\'00"/km');
  assert.equal(paceLabel(8000, 3800), '7\'55"/km');
  assert.equal(paceLabel(null, 3800), 'No disponible');
  assert.equal(paceLabel(0, 3800), 'No disponible');
});
test('unknown metrics stay unknown and totals indicate partial coverage', () => {
  const text = weeklyReport([session(), session({ id: 'missing', started_at: '2026-09-16T08:00:00Z', distance_m: null, active_duration_s: null, hr_avg: null, sensations: null, shoe: null })], '2026-09-16');
  assert.match(text, /8 km \(1\/2 sesiones con distancia\)/);
  assert.doesNotMatch(text, /FC media: No disponible/);
  assert.doesNotMatch(text, /Sensaciones: Pendiente de completar/);
  assert.match(text, /Zapatillas: Trail/);
});
test('laps are not incorrectly labeled as interval series', () => {
  const text = weeklyReport([session({ laps: [{ distance_m: 1000, duration_s: 346 }] })], '2026-09-16');
  assert.match(text, /Vueltas registradas \(no necesariamente series\)/);
  assert.match(text, /5'46"\/km/);
});
test('empty weeks do not fabricate workouts or summaries', () => {
  assert.match(weeklyReport([], '2026-09-16'), /No hay entrenos/);
  assert.equal(weeklyReport([], ''), '');
});

test('imported Samsung notes and manual notes both survive in the report', () => {
  const text = weeklyReport([session({ source_notes: 'Rodaje con viento', notes: 'Zapatillas nuevas' })], '2026-09-16');
  assert.match(text, /Notas de Samsung Health: Rodaje con viento/);
  assert.match(text, /Notas adicionales: Zapatillas nuevas/);
});

test('legacy or unverified durations are not presented as Samsung active time', () => {
  const text = weeklyReport([session()], '2026-09-16');
  assert.match(text, /Duración Health Connect \(pausas no verificadas\)/);
  assert.doesNotMatch(text, /Duración activa:/);
  assert.match(text, /no es el valor original de Samsung/);
});

test('lap pace uses shared pause-adjusted duration when available', () => {
  const text = weeklyReport([session({ laps: [{ distance_m: 1000, duration_s: 400, active_duration_s: 346 }] })], '2026-09-16');
  assert.match(text, /Vuelta 1: distancia 1000 m; tiempo transcurrido 0:06:40/);
  assert.match(text, /tiempo descontando pausas compartidas 0:05:46/);
  assert.match(text, /ritmo medio calculado 5'46"\/km/);
});

test('missing permissions are distinguished from missing upstream records', () => {
  const text = weeklyReport([session({ cadence_avg: null, elevation_gain_m: null, sync_details: { cadence_status: 'permission_denied', elevation_status: 'not_shared' } })], '2026-09-16');
  assert.doesNotMatch(text, /Cadencia ausente:/);
  assert.doesNotMatch(text, /Desnivel ausente:/);
});

test('Samsung mean speed takes precedence over duration/distance-derived pace', () => {
  const workout = session({ distance_m: 10000, active_duration_s: 5000, sync_details: { provider: 'samsung_sdk', samsung_mean_speed_mps: 2.0 } });
  assert.equal(workoutPace(workout).value, '8\'20"/km');
  assert.match(workoutPace(workout).basis, /velocidad media original/);
  const text = weeklyReport([workout], '2026-09-16');
  assert.match(text, /Duración original de Samsung Health/);
  assert.match(text, /Samsung Health Data SDK \(lectura directa\)/);
  assert.doesNotMatch(text, /pausas no verificadas/);
});

test('missing or invalid native speed is explicitly labeled as calculated', () => {
  for (const speed of [null, 0, -1, Infinity]) {
    const workout = session({ sync_details: { provider: 'samsung_sdk', samsung_mean_speed_mps: speed } });
    assert.equal(workoutPace(workout).value, '7\'55"/km');
    assert.match(workoutPace(workout).basis, /velocidad media no disponible/);
  }
});

test('SDK workouts preserve the Health Connect lap provenance', () => {
  const text = weeklyReport([session({ sync_details: { provider: 'samsung_sdk' }, laps: [{ distance_m: 1000, duration_s: 300 }] })], '2026-09-16');
  assert.match(text, /Fuente de las vueltas: Health Connect/);
  assert.match(text, /ritmo medio calculado 5'00"\/km/);
});

test('report omits empty notes and retains split heart rate and real zero elevation', () => {
 const text = weeklyReport([session({ source_notes: '  ', notes: '', sensations: null, shoe: null, elevation_gain_m: 0, sync_details: { report_include_estimates:true, km_split_status: 'calculated', km_splits: [{ distance_m: 1000, duration_s: 360, partial: false, hr_avg: 150 }] } })], '2026-09-16');
 assert.doesNotMatch(text, /Notas de Samsung|Notas adicionales|Sensaciones:|Zapatillas:/);
 assert.match(text, /FC media estimada 150 ppm/);
 assert.match(text, /Desnivel positivo: 0 m/);
});
