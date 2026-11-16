import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOriginalLaps, selectOriginalLaps } from '../lib/original-laps.ts';
import { weeklyReport, lapReport } from '../lib/weekly-report.ts';
const table = {schema_version:1,source:'samsung_screenshot',workout_date:'2026-01-05',session_distance_m:1010,kind:'kilometres',laps:[
  {label:'Km 1',duration_s:400,distance_m:1000,hr_avg:140,pace_s_per_km:400},
  // Independently rounded display values. Their ratio is deliberately different.
  {label:'Final',duration_s:4,distance_m:10,hr_avg:145,pace_s_per_km:500},
]};
const workout = {id:'sample',user_id:'owner',source_id:'source',title:'Running',started_at:'2026-01-05T10:00:00Z',ended_at:'2026-01-05T10:07:00Z',timezone:'UTC',distance_m:1009.2,active_duration_s:404,hr_avg:140,hr_max:null,cadence_avg:null,elevation_gain_m:null,calories_kcal:null,sensations:null,shoe:null,notes:null,laps:null};
test('original display pace is preserved instead of recomputed from rounded distance/time',()=>{
  const text=weeklyReport([{...workout,sync_details:{original_laps:table,analysis_config:{mode:'intervals',clock:'elapsed',blocks:[]},km_split_status:'calculated',km_splits:[{distance_m:1000,duration_s:900,partial:false}]}}],'2026-01-05');
  assert.match(text,/transcritas de captura/);
  assert.match(text,/Final: distancia 10 m; tiempo 0:00:04; ritmo medio 8'20"\/km; FC media 145 ppm/);
  assert.doesNotMatch(text,/estimad|factor|15'00/);
});
test('estimates are visible on request but excluded from the ChatGPT report by default',()=>{
  const details={km_split_status:'calculated',km_splits:[{distance_m:1000,duration_s:400,partial:false}]};
  assert.match(lapReport({...workout,sync_details:details}).join('\n'),/Km 1/);
  assert.doesNotMatch(weeklyReport([{...workout,sync_details:details}],'2026-01-05'),/Km 1/);
  assert.match(weeklyReport([{...workout,sync_details:{...details,report_include_estimates:true}}],'2026-01-05'),/Km 1/);
});
test('matching original tables requires both date and distance and rejects ambiguity',()=>{
  assert.deepEqual(selectOriginalLaps(table,'2026-01-05',1009.2),table);
  assert.throws(()=>selectOriginalLaps(table,'2026-01-06',1009.2));
  assert.throws(()=>selectOriginalLaps(table,'2026-01-05',200));
  assert.throws(()=>selectOriginalLaps([table,table],'2026-01-05',1009.2));
  assert.equal(lapReport({...workout,sync_details:{original_laps:{...table,workout_date:'2026-01-06'}}},{includeEstimates:false}).length,0);
});
test('invalid rows and unknown schema are rejected instead of silently dropped',()=>{
  for(const value of [null,{}, {...table,source:'unknown'}, {...table,laps:[]}, {...table,laps:[{...table.laps[0],hr_avg:-2}]}, {...table,laps:[table.laps[0],table.laps[0]]}])
    assert.throws(()=>validateOriginalLaps(value));
});
