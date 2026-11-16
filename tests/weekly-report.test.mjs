import test from 'node:test';
import assert from 'node:assert/strict';
import { localWorkoutDate, weekDates, weekWorkouts, weeklyReport, paceLabel, workoutPace } from '../lib/weekly-report.ts';

const session = (overrides = {}) => ({
  id: 'id', user_id: 'owner', source_id: 'health-id', title: 'Running',
  started_at: '2026-09-14T08:00:00Z', ended_at: '2026-09-14T09:00:00Z', timezone: 'Atlantic/Canary',
  distance_m: 8000, active_duration_s: 3800, hr_avg: 146, hr_max: 165,
  cadence_avg: 166, elevation_gain_m: 38, calories_kcal: null,
  sensations: 'buenas', shoe: 'Trail', notes: null, laps: null, ...overrides,
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

test('retired detail metadata is ignored without changing stored data', () => {
 const row = session({ sync_details: { provider: 'samsung_sdk', original_laps: { laps: [{ label: 'Legacy imported row' }] }, km_splits: [{ distance_m: 1000, duration_s: 360 }], analysis_config: { mode: 'intervals' }, report_include_estimates: true }, laps: [{ distance_m: 1000, duration_s: 360 }] });
 const before = JSON.stringify(row);
 const text = weeklyReport([row], '2026-09-16');
 assert.doesNotMatch(text, /Vuelta|Parcial|Intervalo|Legacy imported row|estimad|Diagnóstico/i);
 assert.match(text, /FC media: 146 ppm/);
 assert.equal(JSON.stringify(row), before);
});
test('empty fields are omitted while original zero values remain', () => {
 const text = weeklyReport([session({ source_notes: '  ', notes: '', sensations: null, shoe: null, elevation_gain_m: 0 })], '2026-09-16');
 assert.doesNotMatch(text, /Notas de Samsung|Notas adicionales|Sensaciones:|Zapatillas:/);
 assert.match(text, /Desnivel positivo: 0 m/);
});
