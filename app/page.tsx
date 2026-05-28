import data from '@/data/workouts.json';
import SegmentedLists from '@/components/SegmentedLists';
import { type Workout } from '@/lib/utils';

export default function Home() {
  return (
    <>
      <div className="header">
        <div>
          <h1 className="h1">Running · Histórico & Plan</h1>
          <div className="sub">Planes y entrenos separados en pestañas · scroll infinito · filtros.</div>
        </div>
        <div className="badge">v6 · Vercel</div>
      </div>

      <SegmentedLists workouts={data.workouts as Workout[]} />

      <div className="footer">
        <span>API: <a className="btn small" href="/api/workouts">/api/workouts</a></span>
        <span className="muted">Datos en data/workouts.json</span>
      </div>
    </>
  );
}
