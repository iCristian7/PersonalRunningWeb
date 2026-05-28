import data from '@/data/workouts.json';
import WorkoutList from '@/components/WorkoutList';
import { type Workout } from '@/lib/utils';

export default function Home() {
  return (
    <>
      <div className="header">
        <div>
          <h1 className="h1">Running · Histórico & Plan</h1>
          <div className="sub">Samsung Health · Listado completo con scroll infinito y filtros.</div>
        </div>
        <div className="badge">v5 · Vercel</div>
      </div>
      <WorkoutList workouts={data.workouts as Workout[]} />
      <div className="footer">
        <span>API: <a className="btn small" href="/api/workouts">/api/workouts</a></span>
        <span className="muted">Datos en data/workouts.json</span>
      </div>
    </>
  );
}
