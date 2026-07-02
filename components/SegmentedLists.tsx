'use client';

import { useMemo, useState } from 'react';
import WorkoutList from '@/components/WorkoutList';
import ProfileView from '@/components/ProfileView';
import PlansList from '@/components/PlansList';
import { type Workout } from '@/lib/utils';

type Tab = 'entrenos' | 'planes' | 'perfil';
type PlanSubTab = 'correr' | 'fuerza';

type ProfileData = {
  name: string; weightKg: number; heightCm: number; device: string;
  shoes: { name: string; role: string }[]; terrain: string;
  trainingDays: string[]; strengthDays: string[];
  fcMax: number; fcZones: { zone: string; label: string; min: number; max: number }[];
  pbs: { distance: string; time: string; pace: string; date: string; context: string }[];
  goal: { event: string; distance: string; date: string }; longTermGoal: string;
};

function isStrengthPlan(w: Workout): boolean {
  if (w.kind !== 'plan') return false;
  if (w.totalDistance === '—') return true;
  if (w.intensity?.toLowerCase().includes('fuerza')) return true;
  return false;
}

export default function SegmentedLists({ workouts, profile }: { workouts: Workout[]; profile: ProfileData }) {
  const [tab, setTab] = useState<Tab>('entrenos');
  const [planSubTab, setPlanSubTab] = useState<PlanSubTab>('correr');

  const plans = useMemo(() => workouts.filter(w => w.kind === 'plan'), [workouts]);
  const train = useMemo(() => workouts.filter(w => w.kind !== 'plan'), [workouts]);

  const runningPlans = useMemo(() => plans.filter(w => !isStrengthPlan(w)), [plans]);
  const strengthPlans = useMemo(() => plans.filter(w => isStrengthPlan(w)), [plans]);

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

      {tab === 'planes' && (
        <>
          <div className="seg-subtabs">
            <button
              type="button"
              className={`seg-subbtn ${planSubTab === 'correr' ? 'active' : ''}`}
              onClick={() => setPlanSubTab('correr')}
            >
              🏃 Correr
              <span className="seg-count">{runningPlans.length}</span>
            </button>
            <button
              type="button"
              className={`seg-subbtn ${planSubTab === 'fuerza' ? 'active' : ''}`}
              onClick={() => setPlanSubTab('fuerza')}
            >
              💪 Fuerza
              <span className="seg-count">{strengthPlans.length}</span>
            </button>
          </div>

          {planSubTab === 'correr' && <PlansList plans={runningPlans} />}
          {planSubTab === 'fuerza' && <PlansList plans={strengthPlans} />}
        </>
      )}

      {tab === 'perfil' && <ProfileView profile={profile} workouts={workouts} />}
    </>
  );
}
