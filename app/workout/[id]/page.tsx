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
        <Link className="btn" href="/">Volver</Link>
      </div>
    );
  }
  const dateLabel = formatDateES(w.date, w.displayDate);
  const m = w.metrics;
  return (
    <>
      <div className="header">
        <div>
          <h1 className="h1">{w.title}</h1>
          <div className="sub">{dateLabel}</div>
        </div>
        <Link className="btn" href="/">Inicio</Link>
      </div>

      {w.kind === 'plan' ? (
        <>
          <div className="card"><h2>Objetivo</h2><div className="code">{w.objective}</div></div>
          {w.blocks?.map((b) => (
            <div className="card" key={b.name}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <h2>{b.name}</h2>
                <Tag color={b.tag}>{b.tag === 'blue' ? 'Base' : b.tag === 'orange' ? 'Calidad' : b.tag}</Tag>
              </div>
              <ul className="list">{b.items.map((it, idx) => <li key={idx}>{it}</li>)}</ul>
            </div>
          ))}
          <div className="card"><h2>Reglas de oro</h2><ul className="list">{w.rules?.map((r, idx) => <li key={idx}>{r}</li>)}</ul></div>
          <div className="card"><h2>{w.post?.title}</h2><ul className="list">{w.post?.items.map((it, idx) => <li key={idx}>{it}</li>)}</ul></div>
        </>
      ) : (
        <>
          <div className="card">
            <h2>Resumen</h2>
            <table className="table"><tbody>
              <tr><td>Tipo</td><td>{m?.workoutType ?? '—'}</td></tr>
              <tr><td>Distancia</td><td>{m?.distanceKm ?? '—'} km</td></tr>
              <tr><td>Ritmo medio</td><td>{m?.paceAvg ?? '—'}</td></tr>
              <tr><td>FC media</td><td>{m?.hrAvg ?? 'N/D'} ppm</td></tr>
              <tr><td>Cadencia</td><td>{m?.cadenceAvg ?? 'N/D'} ppm</td></tr>
              <tr><td>Desnivel</td><td>{m?.elevationM ?? 'N/D'} m</td></tr>
            </tbody></table>
          </div>
          {m?.notes ? <div className="card"><h2>Notas</h2><div className="code">{m.notes}</div></div> : null}
        </>
      )}

      <div className="footer"><span className="muted">ID: {w.id}</span></div>
    </>
  );
}
