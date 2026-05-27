import data from '@/data/workouts.json';
import Link from 'next/link';
import { formatDateES, type Workout } from '@/lib/utils';

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className={`tag ${color}`}>{children}</span>;
}

export default function WorkoutDetail({ params }: { params: { id: string } }) {
  const workouts = data.workouts as Workout[];
  const w = workouts.find(x => x.id === params.id);

  if (!w) {
    return (
      <div className="card">
        <h1 className="h1">Entrenamiento no encontrado</h1>
        <p className="muted">Revisa el id en <span className="code">data/workouts.json</span>.</p>
        <Link className="btn" href="/">Volver</Link>
      </div>
    );
  }

  return (
    <>
      <div className="header">
        <div>
          <h1 className="h1">{w.dayLabel} · {w.title}</h1>
          <div className="sub">{formatDateES(w.date)} · {w.totalDistance} · {w.intensity}</div>
        </div>
        <Link className="btn" href="/">Inicio</Link>
      </div>

      <div className="card">
        <h2>Objetivo</h2>
        <div className="code">{w.objective}</div>
      </div>

      {w.blocks.map((b) => (
        <div className="card" key={b.name}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <h2>{b.name}</h2>
            <Tag color={b.tag}>{b.tag === 'blue' ? 'Base' : b.tag === 'orange' ? 'Calidad' : b.tag}</Tag>
          </div>
          <ul className="list">
            {b.items.map((it, idx) => (
              <li key={idx}>{it}</li>
            ))}
          </ul>
        </div>
      ))}

      <div className="card">
        <h2>Reglas de oro</h2>
        <ul className="list">
          {w.rules.map((r, idx) => (
            <li key={idx}>{r}</li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>{w.post.title}</h2>
        <ul className="list">
          {w.post.items.map((it, idx) => (
            <li key={idx}>{it}</li>
          ))}
        </ul>
      </div>

      <div className="footer">
        <span>{w.meta?.plan ?? 'Plan'} · Objetivo: {w.meta?.goal ?? '—'} ({w.meta?.eventDate ?? '—'})</span>
        <span className="muted">ID: {w.id}</span>
      </div>
    </>
  );
}
