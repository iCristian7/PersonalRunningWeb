import test from 'node:test';
import assert from 'node:assert/strict';
import { localWorkoutDate, weekDates, weekWorkouts, weeklyReport, paceLabel } from '../lib/weekly-report.ts';

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
  assert.match(text, /FC media: No disponible/);
  assert.match(text, /Sensaciones: Pendiente de completar/);
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
