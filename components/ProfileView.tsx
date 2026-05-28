'use client';

import { useMemo } from 'react';
import { type Workout, isValidISODate } from '@/lib/utils';

/* ── Helpers ───────────────────────────────────────── */

function parsePace(p: string | null | undefined): number | null {
  if (!p) return null;
  const m = p.match(/(\d+)[''′](\d+)/);
  if (!m) return null;
  return parseInt(m[1]) + parseInt(m[2]) / 60;
}

function fmtPace(n: number): string {
  const min = Math.floor(n);
  const sec = Math.round((n - min) * 60);
  return `${min}'${sec.toString().padStart(2, '0')}`;
}

function monthLabel(iso: string) {
  const [y, m] = iso.split('-');
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${months[parseInt(m) - 1]} ${y.slice(2)}`;
}

function monthKey(iso: string) { return iso.slice(0, 7); }

/* ── Stat card ─────────────────────────────────────── */
function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="pf-stat">
      <div className="pf-stat-val" style={accent ? { color: accent } : {}}>{value}</div>
      <div className="pf-stat-lbl">{label}</div>
      {sub && <div className="pf-stat-sub">{sub}</div>}
    </div>
  );
}

/* ── Bar chart (CSS) ───────────────────────────────── */
function BarChart({ data, color = 'var(--brand)', unit = '' }: { data: { label: string; value: number }[]; color?: string; unit?: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="pf-bars">
      {data.map((d, i) => (
        <div key={i} className="pf-bar-col">
          <div className="pf-bar-tip">{Math.round(d.value)}{unit}</div>
          <div className="pf-bar-track">
            <div className="pf-bar-fill" style={{ height: `${(d.value / max) * 100}%`, background: color }} />
          </div>
          <div className="pf-bar-lbl">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Line chart (SVG) ──────────────────────────────── */
function LineChart({ data, color = '#60a5fa', height = 160 }: { data: { x: number; y: number }[]; color?: string; height?: number }) {
  if (data.length < 2) return <div className="muted">No hay datos suficientes</div>;
  const xs = data.map(d => d.x);
  const ys = data.map(d => d.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys) * 0.95, maxY = Math.max(...ys) * 1.05;
  const w = 600, h = height;
  const pad = { l: 0, r: 0, t: 10, b: 10 };
  const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;

  const points = data.map(d => {
    const px = pad.l + ((d.x - minX) / (maxX - minX || 1)) * pw;
    const py = pad.t + ph - ((d.y - minY) / (maxY - minY || 1)) * ph;
    return `${px},${py}`;
  }).join(' ');

  const areaPoints = points + ` ${pad.l + pw},${pad.t + ph} ${pad.l},${pad.t + ph}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
      <defs>
        <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#grad-${color.replace('#','')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Horizontal bars (for type distribution) ──────── */
function HBars({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="pf-hbars">
      {data.map((d, i) => (
        <div key={i} className="pf-hbar-row">
          <div className="pf-hbar-lbl">{d.label}</div>
          <div className="pf-hbar-track">
            <div className="pf-hbar-fill" style={{ width: `${(d.value / max) * 100}%`, background: d.color }} />
          </div>
          <div className="pf-hbar-val">{d.value}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Zone bar ──────────────────────────────────────── */
function ZoneBar({ zone, label, min, max: mx, pct, color }: { zone: string; label: string; min: number; max: number; pct: number; color: string }) {
  return (
    <div className="pf-zone-row">
      <div className="pf-zone-tag" style={{ background: color }}>{zone}</div>
      <div className="pf-zone-info">
        <div>{label} <span className="muted">({min}–{mx} ppm)</span></div>
        <div className="pf-zone-track">
          <div className="pf-zone-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>
      <div className="pf-zone-pct">{pct}%</div>
    </div>
  );
}

/* ── Main component ────────────────────────────────── */
type ProfileData = {
  name: string;
  weightKg: number;
  heightCm: number;
  device: string;
  shoes: { name: string; role: string }[];
  terrain: string;
  trainingDays: string[];
  strengthDays: string[];
  fcMax: number;
  fcZones: { zone: string; label: string; min: number; max: number }[];
  pbs: { distance: string; time: string; pace: string; date: string; context: string }[];
  goal: { event: string; distance: string; date: string };
  longTermGoal: string;
};

export default function ProfileView({ profile, workouts }: { profile: ProfileData; workouts: Workout[] }) {
  const logs = useMemo(() => workouts.filter(w => w.kind !== 'plan').sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')), [workouts]);

  /* ── Computed stats ──────────────────────────────── */
  const stats = useMemo(() => {
    let totalKm = 0, paceSum = 0, paceCount = 0, hrSum = 0, hrCount = 0;
    let cadSum = 0, cadCount = 0, elevSum = 0, maxDist = 0, races = 0;

    for (const w of logs) {
      const m = w.metrics;
      if (m?.distanceKm) { totalKm += m.distanceKm; if (m.distanceKm > maxDist) maxDist = m.distanceKm; }
      const p = parsePace(m?.paceAvg);
      if (p) { paceSum += p; paceCount++; }
      if (m?.hrAvg) { hrSum += m.hrAvg; hrCount++; }
      if (m?.cadenceAvg) { cadSum += m.cadenceAvg; cadCount++; }
      if (m?.elevationM) { elevSum += m.elevationM; }
      if (w.kind === 'race') races++;
    }

    const firstDate = logs[0]?.date ?? '';
    const lastDate = logs[logs.length - 1]?.date ?? '';

    return {
      total: logs.length,
      totalKm: Math.round(totalKm * 10) / 10,
      avgPace: paceCount > 0 ? fmtPace(paceSum / paceCount) : '—',
      avgHr: hrCount > 0 ? Math.round(hrSum / hrCount) : 0,
      avgCad: cadCount > 0 ? Math.round(cadSum / cadCount) : 0,
      totalElev: elevSum,
      maxDist,
      races,
      firstDate,
      lastDate,
    };
  }, [logs]);

  /* ── Monthly volume ──────────────────────────────── */
  const monthly = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of logs) {
      if (!w.date || !w.metrics?.distanceKm) continue;
      const mk = monthKey(w.date);
      map.set(mk, (map.get(mk) ?? 0) + w.metrics.distanceKm);
    }
    const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return sorted.map(([k, v]) => ({ label: monthLabel(k + '-01'), value: v }));
  }, [logs]);

  /* ── Pace over time ──────────────────────────────── */
  const paceData = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < logs.length; i++) {
      const p = parsePace(logs[i].metrics?.paceAvg);
      if (p) pts.push({ x: i, y: p });
    }
    return pts;
  }, [logs]);

  /* ── HR over time ────────────────────────────────── */
  const hrData = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < logs.length; i++) {
      const hr = logs[i].metrics?.hrAvg;
      if (hr) pts.push({ x: i, y: hr });
    }
    return pts;
  }, [logs]);

  /* ── Type distribution ───────────────────────────── */
  const typeDist = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of logs) {
      const t = w.metrics?.workoutType ?? 'Sin tipo';
      map.set(t, (map.get(t) ?? 0) + 1);
    }
    const colors = ['#60a5fa','#fb923c','#34d399','#f87171','#a78bfa','#fbbf24','#ec4899','#6ee7b7','#93c5fd','#fdba74'];
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, color: colors[i % colors.length] }));
  }, [logs]);

  /* ── FC zone distribution ────────────────────────── */
  const zoneStats = useMemo(() => {
    const zones = profile.fcZones;
    const counts = new Array(zones.length).fill(0);
    let total = 0;
    for (const w of logs) {
      const hr = w.metrics?.hrAvg;
      if (!hr) continue;
      total++;
      for (let i = 0; i < zones.length; i++) {
        if (hr >= zones[i].min && hr < zones[i].max) { counts[i]++; break; }
      }
    }
    const colors = ['#34d399','#60a5fa','#fbbf24','#fb923c','#f87171'];
    return zones.map((z, i) => ({
      ...z,
      pct: total > 0 ? Math.round((counts[i] / total) * 100) : 0,
      color: colors[i] ?? '#94a3b8',
    }));
  }, [logs, profile.fcZones]);

  const bmi = (profile.weightKg / ((profile.heightCm / 100) ** 2)).toFixed(1);

  return (
    <div className="pf">
      {/* ── Personal info ──────────────────────────── */}
      <div className="pf-section">
        <div className="card">
          <h2>👤 Perfil</h2>
          <div className="pf-info-grid">
            <div><span className="muted">Nombre</span><br />{profile.name}</div>
            <div><span className="muted">Peso</span><br />{profile.weightKg} kg</div>
            <div><span className="muted">Altura</span><br />{profile.heightCm} cm</div>
            <div><span className="muted">IMC</span><br />{bmi}</div>
            <div><span className="muted">Dispositivo</span><br />{profile.device}</div>
            <div><span className="muted">Terreno</span><br />{profile.terrain}</div>
            <div><span className="muted">Zapatillas</span><br />{profile.shoes.map(s => s.name).join(', ')}</div>
            <div><span className="muted">Días running</span><br />{profile.trainingDays.join(', ')}</div>
          </div>
        </div>
      </div>

      {/* ── Goal ───────────────────────────────────── */}
      <div className="pf-section">
        <div className="card pf-goal">
          <div>
            <h2>🎯 Objetivo actual</h2>
            <div className="pf-goal-event">{profile.goal.event}</div>
            <div className="muted">{profile.goal.distance} · {profile.goal.date}</div>
          </div>
          <div className="pf-goal-long">
            <span className="muted">A largo plazo:</span> {profile.longTermGoal}
          </div>
        </div>
      </div>

      {/* ── Key stats ──────────────────────────────── */}
      <div className="pf-section">
        <h2 className="pf-title">📊 Estadísticas generales</h2>
        <div className="pf-stats-grid">
          <Stat label="Sesiones" value={String(stats.total)} accent="var(--brand)" />
          <Stat label="Km totales" value={String(stats.totalKm)} sub="km" accent="var(--ok)" />
          <Stat label="Carreras" value={String(stats.races)} accent="var(--accent)" />
          <Stat label="Ritmo medio" value={stats.avgPace} sub="/km" />
          <Stat label="FC media" value={`${stats.avgHr}`} sub="ppm" />
          <Stat label="Cadencia media" value={`${stats.avgCad}`} sub="ppm" />
          <Stat label="Desnivel total" value={`${stats.totalElev}`} sub="m" />
          <Stat label="Tirada más larga" value={`${stats.maxDist}`} sub="km" accent="var(--warn)" />
        </div>
      </div>

      {/* ── PBs ────────────────────────────────────── */}
      <div className="pf-section">
        <div className="card">
          <h2>🏆 Récords personales</h2>
          <div className="pf-pbs">
            {profile.pbs.map((pb, i) => (
              <div key={i} className="pf-pb">
                <div className="pf-pb-dist">{pb.distance}</div>
                <div className="pf-pb-time">{pb.time}</div>
                <div className="pf-pb-pace">{pb.pace}/km</div>
                <div className="muted">{pb.date} · {pb.context}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Monthly volume chart ───────────────────── */}
      <div className="pf-section">
        <div className="card">
          <h2>📈 Volumen mensual (km)</h2>
          <BarChart data={monthly} color="var(--brand)" unit=" km" />
        </div>
      </div>

      {/* ── Pace evolution ─────────────────────────── */}
      <div className="pf-section">
        <div className="card">
          <h2>⚡ Evolución del ritmo medio</h2>
          <div className="pf-chart-legend">
            <span className="muted">↑ más lento · ↓ más rápido (min/km)</span>
          </div>
          <LineChart data={paceData} color="#60a5fa" />
        </div>
      </div>

      {/* ── HR evolution ───────────────────────────── */}
      <div className="pf-section">
        <div className="card">
          <h2>❤️ Evolución FC media</h2>
          <div className="pf-chart-legend">
            <span className="muted">ppm por sesión (cronológico)</span>
          </div>
          <LineChart data={hrData} color="#f87171" />
        </div>
      </div>

      {/* ── Type distribution ──────────────────────── */}
      <div className="pf-section">
        <div className="card">
          <h2>🏷️ Distribución por tipo</h2>
          <HBars data={typeDist} />
        </div>
      </div>

      {/* ── FC zone distribution ───────────────────── */}
      <div className="pf-section">
        <div className="card">
          <h2>💓 Distribución por zonas FC</h2>
          <div className="muted" style={{ marginBottom: 10, fontSize: 12 }}>
            Basado en FC media por sesión (FC máx observada: {profile.fcMax} ppm)
          </div>
          {zoneStats.map((z, i) => (
            <ZoneBar key={i} zone={z.zone} label={z.label} min={z.min} max={z.max} pct={z.pct} color={z.color} />
          ))}
        </div>
      </div>
    </div>
  );
}
