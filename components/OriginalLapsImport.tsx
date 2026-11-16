'use client';

import { useState } from 'react';
import { selectOriginalLaps, type OriginalLaps } from '@/lib/original-laps';
import { durationLabel, localWorkoutDate, paceLabel, type SyncedWorkout } from '@/lib/weekly-report';
import { getSupabase } from '@/lib/supabase';

export default function OriginalLapsImport({workout,onSaved}: {workout:SyncedWorkout;onSaved:(w:SyncedWorkout)=>void}) {
  const [preview,setPreview] = useState<OriginalLaps|null>(null);
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  async function save(table?: OriginalLaps, estimates?: boolean) {
    const db=getSupabase();if(!db)return;
    setBusy(true);setMessage('');
    try {
      const {data:latest,error:readError}=await db.from('synced_workouts').select('sync_details').eq('id',workout.id).eq('user_id',workout.user_id).single();
      if(readError)throw readError;
      const details={...latest.sync_details,...(table ? {original_laps:table} : {}),...(estimates!=null ? {report_include_estimates:estimates} : {})};
      const {data,error}=await db.from('synced_workouts').update({sync_details:details}).eq('id',workout.id).eq('user_id',workout.user_id).select('*').single();
      if(error)throw error;
      onSaved(data as SyncedWorkout);setPreview(null);setMessage(table ? 'Tabla guardada. El informe utiliza los valores originales transcritos.' : 'Preferencia del informe guardada.');
    } catch {setMessage('No se pudo guardar. Vuelve a intentarlo.');}
    finally {setBusy(false);}
  }
  return <section className="original-laps-import">
    <p className="muted">Los parciales reconstruidos pueden diferir de las vueltas e intervalos del reloj. El informe prioriza las tablas originales importadas. Las estimaciones se incluyen solo si activas la opción siguiente.</p>
    <label><input type="checkbox" disabled={busy} checked={workout.sync_details?.report_include_estimates===true} onChange={e=>void save(undefined,e.target.checked)}/> Incluir estimaciones en el texto para ChatGPT cuando no haya tabla original</label>
    <details><summary>Importar tabla original de Samsung</summary>
      <p>Selecciona un JSON de tablas transcritas de Samsung. Se comprueban fecha y distancia de esta sesión y puedes revisar las filas antes de guardarlas. Esta acción no modifica el resumen del entreno.</p>
      <label>Archivo de tablas originales<input className="input" type="file" accept=".json,application/json" disabled={busy} onChange={async e=>{
        const file=e.currentTarget.files?.[0];e.currentTarget.value='';setPreview(null);setMessage('');if(!file)return;
        try {
          if(file.size>1_000_000)throw Error('El archivo supera 1 MB. Selecciona un archivo de tablas, no un volcado de muestras.');
          setPreview(selectOriginalLaps(JSON.parse(await file.text()),localWorkoutDate(workout),workout.distance_m));
        } catch(error){setMessage(error instanceof Error ? error.message : 'No se pudo leer la tabla.');}
      }}/></label>
      {preview && <><h4>Revisa la tabla del {preview.workout_date}</h4><p>Estos valores proceden de una transcripción, no de la sincronización del SDK.</p><div className="table-scroll"><table className="table"><thead><tr><th>Bloque</th><th>Tiempo</th><th>Distancia</th><th>FC</th><th>Ritmo mostrado</th></tr></thead><tbody>{preview.laps.map(row=><tr key={row.label}><td>{row.label}</td><td>{durationLabel(row.duration_s)}</td><td>{(row.distance_m/1000).toLocaleString('es-ES',{maximumFractionDigits:2})} km</td><td>{row.hr_avg ?? '—'}</td><td>{row.pace_s_per_km != null ? paceLabel(1000,row.pace_s_per_km) : '—'}</td></tr>)}</tbody></table></div><button className="btn" type="button" disabled={busy} onClick={()=>void save(preview)}>Guardar tabla para este entreno</button></>}
    </details>
    <p role="status">{message}</p>
  </section>;
}
