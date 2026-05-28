'use client';

import { useMemo, useState } from 'react';
import WorkoutList from '@/components/WorkoutList';
import ProfileView from '@/components/ProfileView';
import { type Workout } from '@/lib/utils';

type Tab = 'entrenos' | 'planes' | 'perfil';

type ProfileData = {
  name: string; weightKg: number; heightCm: number; device: string;
  shoes: { name: string; role: string }[]; terrain: string;
  trainingDays: string[]; strengthDays: string[];
  fcMax: number; fcZones: { zone: string; label: string; min: number; max: number }[];
  pbs: { distance: string; time: string; pace: string; date: string; context: string }[];
  goal: { event: string; distance: string; date: string }; longTermGoal: string;
};

export default function SegmentedLists({ workouts, profile }: { workouts: Workout[]; profile: ProfileData }) {
  const [tab, setTab] = useState<Tab>('entrenos');

  const plans = useMemo(() => workouts.filter(w => w.kind === 'plan'), [workouts]);
  const train = useMemo(() => workouts.filter(w => w.kind !== 'plan'), [workouts]);

  return (
    <>
      <div className="seg-tabs">
        <button type="button" className={`seg-btn ${tab === 'entrenos' ? 'active' : ''}`} onClick={() => setTab('entrenos')}>
          🏃 Entrenos
          <span className="seg-count">{train.length}</span>
        </button>
        <button type="button" className={`seg-btn ${tab === 'planes' ? 'active' : ''}`} onClick={() => setTab('planes')}>
          📋 Planes
          <span className="seg-count">{plans.length}</span>
        </button>
        <button type="button" className={`seg-btn ${tab === 'perfil' ? 'active' : ''}`} onClick={() => setTab('perfil')}>
          👤 Perfil
        </button>
      </div>

      {tab === 'entrenos' && <WorkoutList workouts={train} hideKindSelect />}
      {tab === 'planes'   && <WorkoutList workouts={plans} hideKindSelect hideDateFilter />}
      {tab === 'perfil'   && <ProfileView profile={profile} workouts={workouts} />}
    </>
  );
}
