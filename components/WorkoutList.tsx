'use client';

import { useMemo, useState } from 'react';
import WorkoutCard from '@/components/WorkoutCard';
import { norm, type Workout } from '@/lib/utils';

export default function WorkoutList({ workouts }: { workouts: Workout[] }) {
  const [date, setDate] = useState('');
  const [q, setQ] = useState('');

  const sorted = useMemo(() => {
    return workouts.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [workouts]);

  const latest = sorted[0];

  const filtered = useMemo(() => {
    const nq = norm(q.trim());
    return sorted.filter((w) => {
      const matchesDate = !date || w.date === date;
      if (!matchesDate) return false;
      if (!nq) return true;
      const hay = norm(`${w.date} ${w.dayLabel} ${w.title} ${w.objective} ${w.totalDistance} ${w.intensity}`);
      return hay.includes(nq);
    });
  }, [sorted, date, q]);

  const clear = () => {
    setDate('');
    setQ('');
  };

  return (
    <>
      <div className="toolbar">
        <input
          className="input"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Filtrar por fecha"
        />
        <input
          className="input"
          type="search"
          placeholder="Buscar (ej: 'tirada', 'series', '6'30', 'Galway')"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar entrenamientos"
          style={{ minWidth: 260, flex: 1 }}
        />
        <button className="btn" onClick={clear} type="button">Limpiar</button>
      </div>

      <div className="split">
        <span className="pill">Total: <strong style={{ color: 'var(--text)' }}>{workouts.length}</strong></span>
        <span className="pill">Mostrando: <strong style={{ color: 'var(--text)' }}>{filtered.length}</strong></span>
        {latest ? <span className="pill">Último: <strong style={{ color: 'var(--text)' }}>{latest.date}</strong></span> : null}
      </div>

      <div className="hr" />

      {latest ? (
        <div style={{ marginBottom: 14 }}>
          <WorkoutCard w={latest} isLatest />
        </div>
      ) : null}

      <div className="grid" style={{ gridTemplateColumns: '1fr', gap: 12 }}>
        {filtered.filter(w => w.id !== latest?.id).map((w) => (
          <WorkoutCard key={w.id} w={w} />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ marginTop: 14 }}>
          <h2>No hay resultados</h2>
          <p className="muted">Prueba con otra fecha o cambia el texto de búsqueda.</p>
        </div>
      ) : null}
    </>
  );
}
