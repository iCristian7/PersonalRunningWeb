import data from '@/data/workouts.json';
import WorkoutList from '@/components/WorkoutList';
import { type Workout } from '@/lib/utils';

export default function Home() {
  const workouts = data.workouts as Workout[];

  return (
    <>
      <div className="header">
        <div>
          <h1 className="h1">Plan de Running</h1>
          <div className="sub">Listado completo + buscador por fecha. El último entreno aparece destacado arriba.</div>
        </div>
        <div className="badge">Minimal · Vercel-ready</div>
      </div>

      <WorkoutList workouts={workouts} />

      <div className="footer">
        <span>API: <a className="btn small" href="/api/workouts">/api/workouts</a></span>
        <span className="muted">Hecho para Cristian · Running</span>
      </div>
    </>
  );
}
