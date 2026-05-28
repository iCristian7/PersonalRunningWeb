import Link from 'next/link';
import { formatDateES, type Workout } from '@/lib/utils';

function KindTag({ kind }: { kind: Workout['kind'] }) {
  if (kind === 'plan')  return <span className="tag orange">Plan</span>;
  if (kind === 'race')  return <span className="tag blue">Carrera</span>;
  return <span className="tag green">Entreno</span>;
}

export default function WorkoutCard({ w, isLatest }: { w: Workout; isLatest?: boolean }) {
  const dateLabel = formatDateES(w.date, w.displayDate);
  const m = w.metrics;

  return (
    <Link href={`/workout/${w.id}`} className="card-link">
      <div className={`card ${isLatest ? 'latest' : ''}`}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
          <h2 className="h1" style={{ fontSize: 17, margin: 0 }}>{w.title}</h2>
          <KindTag kind={w.kind} />
          {isLatest ? <span className="tag green">Último</span> : null}
        </div>
        <div className="sub" style={{ marginTop: 2, marginBottom: 10 }}>{dateLabel}</div>

        {w.kind === 'plan' ? (
          <div className="kv">
            <div className="muted">Objetivo</div><div>{w.objective}</div>
            <div className="muted">Total</div><div>{w.totalDistance}</div>
            <div className="muted">Intensidad</div><div>{w.intensity}</div>
          </div>
        ) : (
          <div className="kv">
            <div className="muted">Distancia</div><div>{m?.distanceKm ?? '—'} km</div>
            <div className="muted">Ritmo</div><div>{m?.paceAvg ?? '—'}</div>
            <div className="muted">FC media</div><div>{m?.hrAvg ?? 'N/D'} ppm</div>
          </div>
        )}
      </div>
    </Link>
  );
}
