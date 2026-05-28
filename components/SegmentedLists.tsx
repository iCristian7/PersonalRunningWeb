'use client';

import { useMemo, useState } from 'react';
import WorkoutList from '@/components/WorkoutList';
import { type Workout } from '@/lib/utils';

type Tab = 'entrenos' | 'planes';

export default function SegmentedLists({ workouts }: { workouts: Workout[] }) {
  const [tab, setTab] = useState<Tab>('entrenos');

  const plans = useMemo(() => workouts.filter(w => w.kind === 'plan'), [workouts]);
  const train = useMemo(() => workouts.filter(w => w.kind !== 'plan'), [workouts]);

  return (
    <>
      <div className="seg-tabs">
        <button
          type="button"
          className={`seg-btn ${tab === 'entrenos' ? 'active' : ''}`}
          onClick={() => setTab('entrenos')}
        >
          Entrenos &amp; Carreras
          <span className="seg-count">{train.length}</span>
        </button>
        <button
          type="button"
          className={`seg-btn ${tab === 'planes' ? 'active' : ''}`}
          onClick={() => setTab('planes')}
        >
          Planes
          <span className="seg-count">{plans.length}</span>
        </button>
      </div>

      {tab === 'entrenos' ? (
        <WorkoutList workouts={train} hideKindSelect />
      ) : (
        <WorkoutList workouts={plans} hideKindSelect hideDateFilter />
      )}
    </>
  );
}
