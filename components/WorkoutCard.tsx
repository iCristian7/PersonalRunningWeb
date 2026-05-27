import Link from 'next/link';
import { formatDateES, type Workout } from '@/lib/utils';

export default function WorkoutCard({ w, isLatest }: { w: Workout; isLatest?: boolean }) {
  return (
    <div className={`card ${isLatest ? 'latest' : ''}`}>
      <div className="header" style={{ marginTop: 0 }}>
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <h2 className="h1" style={{ fontSize: 18, marginBottom: 0 }}>{w.dayLabel} · {w.title}</h2>
            {isLatest ? <span className="tag green">Último</span> : null}
          </div>
          <div className="sub">{formatDateES(w.date)}</div>
        </div>
        <Link className="btn" href={`/workout/${w.id}`}>Ver detalle</Link>
      </div>
      <div className="kv">
        <div className="muted">Objetivo</div><div>{w.objective}</div>
        <div className="muted">Total</div><div>{w.totalDistance}</div>
        <div className="muted">Intensidad</div><div>{w.intensity}</div>
      </div>
    </div>
  );
}
