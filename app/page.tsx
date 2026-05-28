import data from '@/data/workouts.json';
import profile from '@/data/profile.json';
import SegmentedLists from '@/components/SegmentedLists';
import { type Workout } from '@/lib/utils';

export default function Home() {
  return (
    <>
      <div className="header">
        <div>
          <h1 className="h1">Running · Histórico & Plan</h1>
          <div className="sub">Entrenos · Planes · Perfil & Estadísticas</div>
        </div>
        <div className="badge">v7 · Vercel</div>
      </div>

      <SegmentedLists workouts={data.workouts as Workout[]} profile={profile as any} />

      <div className="footer">
        <span>API: <a className="btn small" href="/api/workouts">/api/workouts</a></span>
        <span className="muted">Datos en data/workouts.json + data/profile.json</span>
      </div>
    </>
  );
}
