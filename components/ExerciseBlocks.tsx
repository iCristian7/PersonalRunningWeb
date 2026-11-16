'use client';

import { useMemo, useState } from 'react';
import { analyseExercise, type AnalysisConfig } from '@/lib/exercise-analysis';
import { paceLabel, type SyncedWorkout } from '@/lib/weekly-report';
import { getSupabase } from '@/lib/supabase';

export default function ExerciseBlocks({ workout, onSaved }: { workout: SyncedWorkout; onSaved: (w: SyncedWorkout) => void }) {
  const [config, setConfig] = useState<AnalysisConfig>(workout.sync_details?.analysis_config ?? { mode:'kilometres',clock:'observed',blocks:[] });
  const [pauses, setPauses] = useState((config.pauses ?? []).map(([a,b]) => `${a}-${b}`).join(', '));
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const elapsed = workout.elapsed_duration_s ?? (Date.parse(workout.ended_at)-Date.parse(workout.started_at))/1000;
  const current = useMemo(() => ({ ...config, pauses: pauses.trim() ? pauses.split(',').map(s => s.trim().split('-').map(Number) as [number,number]) : [] }), [config,pauses]);
  const preview = useMemo(() => analyseExercise(workout.sync_details?.exercise_trace ?? [],elapsed,workout.distance_m,current,workout.sync_details?.shared_pauses,workout.active_duration_s), [workout,elapsed,current]);
  const edit = (i: number, patch: Partial<AnalysisConfig['blocks'][number]>) => setConfig(c => ({ ...c,blocks:c.blocks.map((b,j) => i===j ? {...b,...patch} : b) }));
  async function save() {
    const db = getSupabase(); if (!db) return;
    setBusy(true);setMessage('');
    try {
      // Fetch latest metadata so a mobile sync cannot be overwritten with a stale trace.
      const {data:latest,error:readError} = await db.from('synced_workouts').select('sync_details').eq('id',workout.id).eq('user_id',workout.user_id).single();
      if (readError) throw readError;
      const {data,error} = await db.from('synced_workouts').update({sync_details:{...latest.sync_details,analysis_config:current}}).eq('id',workout.id).eq('user_id',workout.user_id).select('*').single();
      if (error) throw error;
      onSaved(data as SyncedWorkout);setMessage('Estructura guardada. El texto para ChatGPT ya utiliza estos bloques.');
    } catch {setMessage('No se pudo guardar la estructura. Vuelve a intentarlo.');}
    finally {setBusy(false);}
  }
  return <details className="exercise-editor"><summary>Configurar kilómetros o intervalos</summary>
    <p>Samsung no exporta el objetivo ni los intervalos del reloj mediante este SDK. Esta reconstrucción es exploratoria: puede diferir de los límites y resultados originales. Para reproducir la tabla de Samsung utiliza «Importar tabla original».</p>
    <div className="health-form">
      <label>Desglose<select className="input" value={config.mode} onChange={e => setConfig(c => ({...c,mode:e.target.value as AnalysisConfig['mode']}))}><option value="kilometres">Cada kilómetro</option><option value="intervals">Bloques de intervalos indicados por mí</option></select></label>
      <label>Reloj de los bloques<select className="input" value={config.clock} onChange={e => setConfig(c => ({...c,clock:e.target.value as AnalysisConfig['clock']}))}>
        <option value="observed">Tiempo observado · pausas inferidas, aproximado</option><option value="active">Tiempo activo · requiere pausas reales</option><option value="elapsed">Tiempo transcurrido · incluye pausas</option></select></label>
      <p className="muted">Si no sabes cómo contó las pausas el reloj, tiempo observado ofrece una aproximación; no garantiza que los bloques coincidan con sus avisos.</p>
      {config.clock==='active' && <><label>Pausas reales, en segundos desde el inicio (ejemplo: 120-180, 900-960)<input className="input" value={pauses} onChange={e=>setPauses(e.target.value)} /></label><label><span><input type="checkbox" checked={!!config.noPausesConfirmed} onChange={e=>setConfig(c=>({...c,noPausesConfirmed:e.target.checked}))}/> Confirmo que no pausé el entreno</span></label></>}
      {config.mode==='intervals' && <>
        <button type="button" className="btn" onClick={()=>setConfig(c=>({...c,blocks:[
          {label:'Calentamiento',basis:'distance',value:2000},
          ...[1,2,3].flatMap(i=>[{label:`Trabajo ${i}`,basis:'time' as const,value:480},{label:`Recuperación ${i}`,basis:'time' as const,value:120}]),
          {label:'Enfriamiento',basis:'distance',value:3000},
        ]}))}>Usar estructura: 2 km + 3 × (8 min / 2 min) + 3 km</button>
        {config.blocks.map((b,i)=><fieldset className="exercise-block-row" key={i}><legend>Bloque {i+1}</legend><label>Nombre<input className="input" value={b.label} onChange={e=>edit(i,{label:e.target.value})}/></label><label>Medida<select className="input" value={b.basis} onChange={e=>edit(i,{basis:e.target.value as 'distance'|'time'})}><option value="time">Tiempo (segundos)</option><option value="distance">Distancia (metros)</option></select></label><label>Cantidad<input className="input" type="number" min="1" value={b.value} onChange={e=>edit(i,{value:Number(e.target.value)})}/></label><button className="btn" type="button" onClick={()=>setConfig(c=>({...c,blocks:c.blocks.filter((_,j)=>j!==i)}))}>Quitar bloque {i+1}</button></fieldset>)}
        <button className="btn" type="button" onClick={()=>setConfig(c=>({...c,blocks:[...c.blocks,{label:`Bloque ${c.blocks.length+1}`,basis:'time',value:60}]}))}>Añadir bloque</button>
      </>}
      {preview.error ? <p role="status">{preview.error}</p> : <><p>Vista previa calculada. Para exportarla debes guardar y activar «Incluir estimaciones». Una tabla original importada tiene prioridad.</p>{preview.blocks.map((b,i)=><p key={i}>{b.label}: {Math.round(b.distance)} m · {Math.round(b.seconds)} s · {paceLabel(b.distance,b.seconds)}{b.heartRate != null ? ` · FC ${Math.round(b.heartRate)} ppm` : ''}</p>)}</>}
      <button className="btn" type="button" disabled={busy || !!preview.error} onClick={()=>void save()}>{busy?'Guardando…':'Guardar desglose'}</button>
      <p role="status">{message}</p>
    </div>
  </details>;
}
