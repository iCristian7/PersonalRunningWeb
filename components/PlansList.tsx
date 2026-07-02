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

function safeDate(w: Workout): string {
  return (w as any).date ?? '';
}

function classifyPlans(plans: Workout[]): { plan: Workout; status: PlanStatus }[] {
  const today = todayISO();
  const sorted = [...plans].sort((a, b) => safeDate(a).localeCompare(safeDate(b)));
  const futureOrToday = sorted.filter(p => safeDate(p) >= today);
  const nextDate = futureOrToday.length > 0 ? safeDate(futureOrToday[0]) : null;

  return sorted.map(plan => {
    const pDate = safeDate(plan);
    let status: PlanStatus;
    if (!pDate || pDate < today) status = 'past';
    else if (pDate === nextDate) status = 'next';
    else status = 'future';
    return { plan, status };
  });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function getWeekday(iso: string | null | undefined): string {
  if (!iso) return '';
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d.getTime())) return '';
  return days[d.getDay()];
}

export default function PlansList({ plans }: { plans: Workout[] }) {
  const classified = useMemo(() => classifyPlans(plans), [plans]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
        // Cast to any to access optional plan-specific fields not in Workout type
        const p = plan as any;
        const isExpanded = expandedId === plan.id;
        const weekday = getWeekday(p.date);
        const dateStr = formatDate(p.date);
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
                  {weekday ? `${weekday} · ` : ''}{dateStr}
                </div>
                <div className="plan-title">{p.title}</div>
                {p.totalDistance && p.totalDistance !== '—' && (
                  <div className="plan-distance">📏 {p.totalDistance}</div>
                )}
                {p.intensity && (
                  <div className="plan-intensity">💪 {p.intensity}</div>
                )}
              </div>
              <div className="plan-chevron">{isExpanded ? '▲' : '▼'}</div>
            </button>

            {isExpanded && (
              <div className="plan-body">
                {p.objective && (
                  <div className="plan-section">
                    <strong>🎯 Objetivo:</strong>
                    <p>{p.objective}</p>
                  </div>
                )}
                {p.blocks && p.blocks.length > 0 && (
                  <div className="plan-section">
                    <strong>📋 Estructura:</strong>
                    {p.blocks.map((b: any, i: number) => (
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
                {p.rules && p.rules.length > 0 && (
                  <div className="plan-section">
                    <strong>⚠️ Reglas:</strong>
                    <ul>
                      {p.rules.map((r: string, i: number) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {p.techFocus && p.techFocus.length > 0 && (
                  <div className="plan-section">
                    <strong>🧠 Focus técnico:</strong>
                    <ul>
                      {p.techFocus.map((t: string, i: number) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {p.post && (
                  <div className="plan-section">
                    <strong>🧊 {p.post.title}:</strong>
                    <ul>
                      {p.post.items.map((pi: string, i: number) => (
                        <li key={i}>{pi}</li>
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
