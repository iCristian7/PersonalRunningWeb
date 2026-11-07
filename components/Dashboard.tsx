'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Workout, ProfileData } from '@/lib/utils';

const number = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 1 });
export default function Dashboard({ workouts, profile }: { workouts: Workout[]; profile: ProfileData }) {
  const [weeks, setWeeks] = useState(12);
  const stats = useMemo(() => {
    const dated = workouts.filter(w => w.date && /^\d{4}-\d{2}-\d{2}$/.test(w.date)).sort((a,b) => a.date!.localeCompare(b.date!));
    const last = dated.at(-1)?.date;
    if (!last) return null;
    const end = new Date(last + 'T12:00:00Z');
    end.setUTCDate(end.getUTCDate() - (end.getUTCDay() + 6) % 7);
    const buckets = Array.from({ length: weeks }, (_, i) => {
      const start = new Date(end); start.setUTCDate(start.getUTCDate() - (weeks - 1 - i) * 7);
      return { date: start.toISOString().slice(0,10), km: 0, sessions: 0 };
    });
    const rows = dated.filter(w => w.date! >= buckets[0].date);
    let known = 0, km = 0, elevation = 0;
    for (const row of rows) {
      const bucket = [...buckets].reverse().find(b => b.date <= row.date!);
      if (bucket) bucket.sessions++;
      const distance = row.metrics?.distanceKm;
      if (typeof distance === 'number' && Number.isFinite(distance) && distance >= 0) {
        known++; km += distance; if (bucket) bucket.km += distance;
      }
      elevation += row.metrics?.elevationM ?? 0;
    }
    return { rows, buckets, known, km, elevation, last };
  }, [workouts, weeks]);
  if (!stats) return <div className="card empty">Tu resumen aparecerá cuando registres tu primer entreno con fecha.</div>;
  const maximum = Math.max(1, ...stats.buckets.map(b => b.km));
  return <section className="dashboard" aria-label="Resumen de entrenamiento">
    <div className="overview-heading"><div><p className="eyebrow">CADA SEMANA CUENTA</p><h2>Tu progreso, en perspectiva</h2><p className="muted">Histórico registrado · hasta el {stats.last.split('-').reverse().join('/')}. Samsung Health se consulta en su sección.</p></div>
      <label className="period-control">Periodo<select className="input" value={weeks} onChange={e => setWeeks(Number(e.target.value))}><option value={4}>4 semanas</option><option value={12}>12 semanas</option><option value={26}>26 semanas</option></select></label></div>
    <div className="overview-metrics">{[
      ['Distancia registrada', number(stats.km), 'km'],
      ['Entrenamientos', String(stats.rows.length), 'sesiones'],
      ['Media semanal', number(stats.km / weeks), 'km / semana'],
      ['Desnivel registrado', number(stats.elevation), 'm'],
    ].map(([label,value,unit]) => <div className="metric-tile" key={label}><span>{label}</span><strong>{value}<small>{unit}</small></strong></div>)}</div>
    <div className="overview-columns"><article className="card volume-card"><p className="eyebrow">VOLUMEN SEMANAL</p><h2>Construyendo constancia</h2><p className="muted">Distancia disponible en {stats.known} de {stats.rows.length} sesiones. La última semana puede estar incompleta.</p>
      <div className="volume-chart" aria-label="Kilómetros por semana">{stats.buckets.map(b => <div className="volume-column" key={b.date}><span>{number(b.km)}</span><div className="volume-track"><div style={{ height: `${b.km / maximum * 100}%` }} /></div><small>{b.date.slice(8)}/{b.date.slice(5,7)}</small></div>)}</div>
      <details><summary>Ver datos del gráfico</summary><div className="table-scroll"><table className="table"><thead><tr><th scope="col">Semana del</th><th scope="col">Km registrados</th><th scope="col">Sesiones</th></tr></thead><tbody>{stats.buckets.map(b => <tr key={b.date}><td>{b.date}</td><td>{number(b.km)}</td><td>{b.sessions}</td></tr>)}</tbody></table></div></details>
    </article><aside className="card goal-card"><p className="eyebrow">TU OBJETIVO</p><h2>{profile.goal.event}</h2><div className="goal-distance">{profile.goal.distance}</div><p>{profile.goal.date}</p><div className="hr"/><p className="muted">{profile.longTermGoal}</p><p className="eyebrow">TU RUTINA</p><p>{profile.trainingDays.join(' · ')}</p></aside></div>
    <article className="card"><p className="eyebrow">ÚLTIMAS SESIONES</p><h2>El trabajo que ya has hecho</h2><div className="recent-sessions">{stats.rows.slice(-5).reverse().map(w => <Link className="recent-session" key={w.id} href={`/workout/${encodeURIComponent(w.id)}`}><span><small className="muted">{w.date}</small><strong>{w.title}</strong></span><span>{w.metrics?.distanceKm != null ? `${number(w.metrics.distanceKm)} km` : 'Distancia pendiente'} <span aria-hidden="true">↗</span></span></Link>)}</div></article>
  </section>;
}
