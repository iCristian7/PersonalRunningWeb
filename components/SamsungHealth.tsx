'use client';

import { useEffect, useMemo, useState } from 'react';
import { type User } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { localWorkoutDate, paceLabel, weekDates, weekWorkouts, weeklyReport, type SyncedWorkout } from '@/lib/weekly-report';
import type { ProfileData } from '@/lib/utils';

function errorText(error: { message: string; code?: string }): string {
  if (error.code === '42P01' || error.code === 'PGRST205') return 'Falta crear la tabla de entrenos en Supabase. Ejecuta el archivo de tablas en SQL Editor.';
  if (error.message.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (error.message.includes('Email not confirmed')) return 'Confirma tu correo antes de entrar.';
  return error.message;
}

function SessionCard({ workout, shoes, onSaved }: { workout: SyncedWorkout; shoes: ProfileData['shoes']; onSaved: (row: SyncedWorkout) => void }) {
  const [sensations, setSensations] = useState(workout.sensations ?? '');
  const [shoe, setShoe] = useState(workout.shoe ?? '');
  const [notes, setNotes] = useState(workout.notes ?? '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const db = getSupabase();
    if (!db) return;
    setBusy(true); setMessage('');
    try {
      const { data, error } = await db.from('synced_workouts').update({
        sensations: sensations.trim() || null, shoe: shoe.trim() || null, notes: notes.trim() || null,
      }).eq('id', workout.id).eq('user_id', workout.user_id).select('*').single();
      if (error) throw error;
      onSaved(data as SyncedWorkout); setMessage('Guardado.');
    } catch (error) { setMessage(errorText(error as { message: string })); }
    finally { setBusy(false); }
  }
  return <article className="card health-session">
    <h3>{workout.title} · {localWorkoutDate(workout).split('-').reverse().join('/')}</h3>
    <p className="muted">{workout.distance_m == null ? 'Distancia no disponible' : `${(workout.distance_m / 1000).toLocaleString('es-ES', { maximumFractionDigits: 2 })} km`} · {paceLabel(workout.distance_m, workout.active_duration_s)} · FC media: {workout.hr_avg == null ? 'N/D' : `${Math.round(workout.hr_avg)} ppm`}</p>
    <form onSubmit={save} className="health-form">
      <label>Sensaciones<input className="input" value={sensations} maxLength={1000} onChange={e => setSensations(e.target.value)} placeholder="Buenas, cansancio, molestias…" /></label>
      <label>Zapatillas<select className="input" value={shoe} onChange={e => setShoe(e.target.value)}>
        <option value="">Pendiente de completar</option>
        {shoe && !shoes.some(s => s.name === shoe) && <option value={shoe}>{shoe}</option>}
        {shoes.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
      </select></label>
      <label>Notas<textarea className="input" value={notes} maxLength={5000} onChange={e => setNotes(e.target.value)} placeholder="Series realizadas, esfuerzo percibido, contexto…" /></label>
      <button className="btn" disabled={busy} type="submit">{busy ? 'Guardando…' : 'Guardar sensaciones y zapatillas'}</button>
      <span role="status">{message}</span>
    </form>
  </article>;
}

export default function SamsungHealth({ profile }: { profile: ProfileData }) {
  const db = getSupabase();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [date, setDate] = useState('');
  const [rows, setRows] = useState<SyncedWorkout[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [copyMessage, setCopyMessage] = useState('');

  useEffect(() => {
    const previous = new Date(); previous.setDate(previous.getDate() - 7);
    setDate(`${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}-${String(previous.getDate()).padStart(2, '0')}`);
    if (!db) { setAuthReady(true); return; }
    let current = true;
    db.auth.getSession().then(({ data, error }) => {
      if (!current) return;
      if (error) setMessage(errorText(error));
      setUser(data.session?.user ?? null); setAuthReady(true);
    });
    const { data: listener } = db.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null); setAuthReady(true); setRows([]);
    });
    return () => { current = false; listener.subscription.unsubscribe(); };
  }, [db]);

  useEffect(() => {
    if (!db || !user || !date) { setRows([]); return; }
    let current = true;
    setLoading(true); setRows([]); setLoadError(''); setCopyMessage('');
    const { start, end } = weekDates(date);
    // Fetch a UTC envelope; then use each session's timezone for exact week boundaries.
    const from = new Date(`${start}T00:00:00Z`); from.setUTCDate(from.getUTCDate() - 1);
    const until = new Date(`${end}T00:00:00Z`); until.setUTCDate(until.getUTCDate() + 2);
    db.from('synced_workouts').select('*').eq('user_id', user.id)
      .gte('started_at', from.toISOString()).lt('started_at', until.toISOString())
      .order('started_at').limit(1000).then(({ data, error }) => {
        if (!current) return;
        if (error) setLoadError(errorText(error));
        else if (data.length === 1000) setLoadError('Demasiadas sesiones para mostrar la semana completa. No se generará un resumen parcial.');
        else setRows(data as SyncedWorkout[]);
        setLoading(false);
      }, () => { if (current) { setLoadError('No se pudo conectar. Comprueba internet y pulsa Actualizar.'); setLoading(false); } });
    return () => { current = false; };
  }, [db, user, date, reload]);

  const sessions = useMemo(() => weekWorkouts(rows, date), [rows, date]);
  const report = useMemo(() => weeklyReport(rows, date), [rows, date]);

  async function authenticate(register: boolean) {
    if (!db) return;
    setBusy(true); setMessage('');
    try {
      if (register) {
        const { data, error } = await db.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        setMessage(data.session ? 'Cuenta creada.' : 'Revisa tu correo y confirma la cuenta. Después puedes entrar aquí y en la app Android.');
      } else {
        const { error } = await db.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
      setPassword('');
    } catch (error) { setMessage(errorText(error as { message: string })); }
    finally { setBusy(false); }
  }

  if (!db) return <div className="card"><h2>Samsung Health</h2><p>La conexión todavía no está configurada en este despliegue.</p></div>;
  if (!authReady) return <div className="card" role="status">Comprobando sesión…</div>;
  if (!user) return <section className="card">
    <h2>Tus entrenos de Samsung Health</h2>
    <p>Crea una cuenta para tus entrenos y usa la misma en la app del móvil. Esta cuenta es independiente de tu acceso al panel de Supabase.</p>
    <form className="health-form" onSubmit={e => { e.preventDefault(); void authenticate(false); }}>
      <label>Correo<input className="input" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Contraseña<input className="input" type="password" autoComplete="current-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} /></label>
      <div className="health-actions"><button className="btn" disabled={busy} type="submit">Entrar</button><button className="btn" disabled={busy || !email || password.length < 8} type="button" onClick={() => void authenticate(true)}>Crear cuenta</button></div>
      <p role="status">{busy ? 'Conectando…' : message}</p>
    </form>
  </section>;
  return <section className="health-panel">
    <div className="card">
      <h2>Samsung Health · Resumen semanal</h2>
      <p className="muted">Conectado como {user.email}. Sincroniza desde la app del móvil y pulsa Actualizar.</p>
      <div className="health-actions">
        <label>Elige un día de la semana<input className="input" type="date" required value={date} onChange={e => setDate(e.target.value)} /></label>
        <button className="btn" disabled={loading} onClick={() => setReload(n => n + 1)}>Actualizar</button>
        <button className="btn" onClick={async () => { const { error } = await db.auth.signOut(); if (error) setMessage(errorText(error)); }}>Cerrar sesión</button>
      </div>
      {date && <p>Semana del {weekDates(date).start.split('-').reverse().join('/')} al {weekDates(date).end.split('-').reverse().join('/')} · {sessions.length} entrenos</p>}
      {message && <p role="status">{message}</p>}
      {loading && <p role="status">Cargando entrenos…</p>}
      {loadError && <p role="alert">{loadError}</p>}
      {!loading && !loadError && !sessions.length && <p>No hay entrenos sincronizados en esta semana. El histórico manual sigue en la pestaña Entrenos.</p>}
    </div>
    {!loading && !loadError && sessions.map(w => <SessionCard key={w.id} workout={w} shoes={profile.shoes} onSaved={updated => setRows(previous => previous.map(row => row.id === updated.id ? updated : row))} />)}
    {!loading && !loadError && sessions.length > 0 && <div className="card">
      <h3>Texto para ChatGPT</h3>
      <p className="muted">Revisa sensaciones y zapatillas antes de copiar. El ritmo se calcula a partir de duración activa y distancia; puede diferir del que muestra el reloj.</p>
      <textarea className="input health-report" aria-label="Resumen semanal para ChatGPT" readOnly value={report} />
      <button className="btn" onClick={async () => { try { await navigator.clipboard.writeText(report); setCopyMessage('Resumen copiado. Ya puedes pegarlo en ChatGPT.'); } catch { setCopyMessage('Selecciona el texto del resumen y cópialo manualmente.'); } }}>Copiar resumen para ChatGPT</button>
      <p role="status">{copyMessage}</p>
    </div>}
  </section>;
}
