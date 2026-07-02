'use client';

import { useMemo, useState } from 'react';
import { type Workout } from '@/lib/utils';

type PlanStatus = 'past' | 'next' | 'future';

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function classifyPlans(plans: Workout[]): { plan: Workout; status: PlanStatus }[] {
  const today = todayISO();
  const sorted = [...plans].sort((a, b) => a.date.localeCompare(b.date));
  const futureOrToday = sorted.filter(p => p.date >= today);
  const nextDate = futureOrToday.length > 0 ? futureOrToday[0].date : null;

  return sorted.map(plan => {
    let status: PlanStatus;
    if (plan.date < today) status = 'past';
    else if (plan.date === nextDate) status = 'next';
    else status = 'future';
    return { plan, status };
  });
}

// Format date DD/MM/YYYY
function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// Get weekday in Spanish
function getWeekday(iso: string): string {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const d = new Date(iso + 'T12:00:00');
  return days[d.getDay()];
}

export default function PlansList({ plans }: { plans: Workout[] }) {
  const classified = useMemo(() => classifyPlans(plans), [plans]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Order: next first, then future (chronological), then past (reverse chronological)
  const ordered = useMemo(() => {
    const next = classified.filter(c => c.status === 'next');
    const future = classified.filter(c => c.status === 'future');
    const past = [...classified.filter(c => c.status === 'past')].reverse();
    return [...next, ...future, ...past];
  }, [classified]);

  if (ordered.length === 0) {
    return <p className="empty">No hay planes.</p>;
  }

  return (
    <div className="plans-status-list">
      {ordered.map(({ plan, status }) => {
        const isExpanded = expandedId === plan.id;
        return (
          <div
            key={plan.id}
            className={`plan-card plan-${status} ${isExpanded ? 'expanded' : ''}`}
          >
            <button
              type="button"
              className="plan-header"
              onClick={() => setExpandedId(isExpanded ? null : plan.id)}
              aria-expanded={isExpanded}
            >
              <div className="plan-badge-wrap">
                {status === 'next' && <span className="plan-badge next">🎯 Siguiente</span>}
                {status === 'past' && <span className="plan-badge past">✅ Hecho</span>}
                {status === 'future' && <span className="plan-badge future">📋 Pendiente</span>}
              </div>
              <div className="plan-title-wrap">
                <div className="plan-date">
                  {getWeekday(plan.date)} · {formatDate(plan.date)}
                </div>
                <div className="plan-title">{plan.title}</div>
                {plan.totalDistance && plan.totalDistance !== '—' && (
                  <div className="plan-distance">📏 {plan.totalDistance}</div>
                )}
                {plan.intensity && (
                  <div className="plan-intensity">💪 {plan.intensity}</div>
                )}
              </div>
              <div className="plan-chevron">{isExpanded ? '▲' : '▼'}</div>
            </button>

            {isExpanded && (
              <div className="plan-body">
                {plan.objective && (
                  <div className="plan-section">
                    <strong>🎯 Objetivo:</strong>
                    <p>{plan.objective}</p>
                  </div>
                )}
                {plan.blocks && plan.blocks.length > 0 && (
                  <div className="plan-section">
                    <strong>📋 Estructura:</strong>
                    {plan.blocks.map((b: any, i: number) => (
                      <div key={i} className={`plan-block plan-block-${b.tag || 'blue'}`}>
                        <div className="plan-block-name">{b.name}</div>
                        <ul>
                          {b.items.map((it: string, j: number) => (
                            <li key={j}>{it}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
                {plan.rules && plan.rules.length > 0 && (
                  <div className="plan-section">
                    <strong>⚠️ Reglas:</strong>
                    <ul>
                      {plan.rules.map((r: string, i: number) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {plan.techFocus && plan.techFocus.length > 0 && (
                  <div className="plan-section">
                    <strong>🧠 Focus técnico:</strong>
                    <ul>
                      {plan.techFocus.map((t: string, i: number) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {plan.post && (
                  <div className="plan-section">
                    <strong>🧊 {plan.post.title}:</strong>
                    <ul>
                      {plan.post.items.map((p: string, i: number) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
