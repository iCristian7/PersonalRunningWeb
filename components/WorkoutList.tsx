'use client';

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import WorkoutCard from '@/components/WorkoutCard';
import { norm, sortByDateDesc, type Workout, type WorkoutKind, isValidISODate } from '@/lib/utils';

const PAGE_SIZE = 15;

const kindOptions: { label: string; value: WorkoutKind | 'all' }[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Histórico', value: 'log' },
  { label: 'Carreras', value: 'race' },
  { label: 'Plan', value: 'plan' },
];

export default function WorkoutList({ workouts }: { workouts: Workout[] }) {
  const [date, setDate] = useState('');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<WorkoutKind | 'all'>('all');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(() => workouts.slice().sort(sortByDateDesc), [workouts]);

  const latest = useMemo(() => {
    const pool = sorted.filter(w => (kind === 'all' ? true : w.kind === kind));
    return pool.find(w => isValidISODate(w.date)) ?? pool[0];
  }, [sorted, kind]);

  const filtered = useMemo(() => {
    const nq = norm(q.trim());
    return sorted.filter((w) => {
      if (kind !== 'all' && w.kind !== kind) return false;
      if (date && w.date !== date) return false;
      if (!nq) return true;
      const m = w.metrics;
      const hay = norm(
        `${w.date ?? ''} ${w.displayDate ?? ''} ${w.kind} ${w.title} ${w.objective ?? ''} ` +
        `${w.totalDistance ?? ''} ${w.intensity ?? ''} ${m?.distanceKm ?? ''} ${m?.paceAvg ?? ''} ` +
        `${m?.hrAvg ?? ''} ${m?.cadenceAvg ?? ''} ${m?.elevationM ?? ''} ${m?.workoutType ?? ''} ${m?.notes ?? ''}`
      );
      return hay.includes(nq);
    });
  }, [sorted, date, q, kind]);

  // Reset visible count when filters change
  useEffect(() => { setVisible(PAGE_SIZE); }, [date, q, kind]);

  // rest = filtered minus the latest (shown separately)
  const rest = useMemo(() => filtered.filter(w => w.id !== latest?.id), [filtered, latest]);
  const shown = rest.slice(0, visible);
  const hasMore = visible < rest.length;

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setVisible((v) => Math.min(v + PAGE_SIZE, rest.length));
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, rest.length]);

  const clear = () => { setDate(''); setQ(''); setKind('all'); };

  return (
    <>
      <div className="toolbar">
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value as any)} aria-label="Filtrar por tipo">
          {kindOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Filtrar por fecha" />
        <input
          className="input"
          type="search"
          placeholder="Buscar (ej: 'tirada', 'series', '6'30')"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar"
          style={{ minWidth: 240, flex: 1 }}
        />
        <button className="btn" onClick={clear} type="button">Limpiar</button>
      </div>

      <div className="split">
        <span className="pill">Total: <strong style={{ color: 'var(--text)' }}>{workouts.length}</strong></span>
        <span className="pill">Mostrando: <strong style={{ color: 'var(--text)' }}>{Math.min(shown.length + (latest ? 1 : 0), filtered.length)}</strong></span>
        {latest?.date && <span className="pill">Último: <strong style={{ color: 'var(--text)' }}>{latest.displayDate ?? latest.date}</strong></span>}
      </div>

      <div className="hr" />

      {latest && <div style={{ marginBottom: 14 }}><WorkoutCard w={latest} isLatest /></div>}

      <div className="grid" style={{ gridTemplateColumns: '1fr', gap: 12 }}>
        {shown.map((w) => <WorkoutCard key={w.id} w={w} />)}
      </div>

      {/* Infinite scroll sentinel */}
      {hasMore && (
        <div ref={sentinelRef} className="load-more">
          <span className="btn" style={{ pointerEvents: 'none', opacity: .6 }}>Cargando más…</span>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="card" style={{ marginTop: 14 }}>
          <h2>No hay resultados</h2>
          <p className="muted">Prueba con otra fecha o cambia el texto de búsqueda.</p>
        </div>
      )}
    </>
  );
}
