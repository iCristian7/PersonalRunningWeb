import data from '@/data/workouts.json';
import WorkoutList from '@/components/WorkoutList';
import { type Workout } from '@/lib/utils';

export default function Home() {
  const workouts = data.workouts as Workout[];
  return (
    <>
      <div className="header">
        <div>
          <h1 className="h1">Running · Histórico & Plan</h1>
          <div className="sub">Actualizado desde Samsung Health. Listado completo + filtros.</div>
        </div>
        <div className="badge">Vercel-ready</div>
      </div>
      <WorkoutList workouts={workouts} />
      <div className="footer">
        <span>API: <a className="btn small" href="/api/workouts">/api/workouts</a></span>
        <span className="muted">Datos en <span className="code">data/workouts.json</span></span>
      </div>
    </>
  );
}
