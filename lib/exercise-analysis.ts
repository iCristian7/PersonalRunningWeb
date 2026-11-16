export type TraceSample = [number, number | null, number | null];
export type AnalysisConfig = {
  mode: 'kilometres' | 'intervals';
  clock: 'elapsed' | 'active' | 'observed';
  noPausesConfirmed?: boolean;
  pauses?: [number, number][];
  blocks: { label: string; basis: 'distance' | 'time'; value: number }[];
};
export type AnalysisResult = {
  error?: string;
  blocks: { label: string; seconds: number; distance: number; heartRate: number | null }[];
  scale?: number;
  edgeSeconds?: number;
  gapSeconds?: number;
};

/** Reconstruct from observed samples and explicit user/Health Connect pause windows.
 * Never infer workout type, interval boundaries or pause placement from mean speed. */
export function analyseExercise(trace: TraceSample[], elapsed: number, distance: number | null,
  config: AnalysisConfig, sharedPauses?: [number, number][], activeSeconds?: number | null): AnalysisResult {
  const fail = (error: string): AnalysisResult => ({ error, blocks: [] });
  if (!Number.isFinite(elapsed) || elapsed <= 0 || !trace?.length) return fail('Vuelve a sincronizar con Running Sync 0.8.0 para disponer de las muestras.');
  if (!['elapsed', 'active', 'observed'].includes(config.clock) || !['kilometres', 'intervals'].includes(config.mode)) return fail('Configuración de análisis inválida.');
  const requestedPauses = config.pauses?.length ? config.pauses : sharedPauses ?? [];
  if (config.clock === 'active' && !requestedPauses.length && !config.noPausesConfirmed)
    return fail('Para usar tiempo activo hacen falta las pausas del reloj o confirmar que no hubo pausas. La duración total no permite situarlas.');
  if (requestedPauses.some(([a,b]) => !Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b <= a || b > elapsed)) return fail('Revisa los tiempos de las pausas: deben estar dentro del entreno.');
  const pauses: [number, number][] = [];
  if (config.clock === 'active') for (const [a,b] of [...requestedPauses].sort((a,b) => a[0]-b[0])) {
    const previous = pauses.at(-1);
    if (previous && a <= previous[1]) previous[1] = Math.max(previous[1], b);
    else pauses.push([a,b]);
  }
  const grouped = new Map<number, { speed: number | null; hr: number | null }>();
  for (const [t,v,h] of trace) {
    if (!Number.isFinite(t) || t < 0 || t > elapsed) continue;
    const row = grouped.get(t) ?? { speed: null, hr: null };
    if (v != null) {
      if (!Number.isFinite(v) || v < 0 || v > 20) return fail('Hay velocidades inválidas en las muestras.');
      if (row.speed != null && row.speed !== v) return fail('Hay velocidades contradictorias para el mismo instante.');
      row.speed = v;
    }
    if (h != null && Number.isFinite(h) && h > 0) row.hr = h;
    grouped.set(t,row);
  }
  const points = [...grouped].sort((a,b) => a[0]-b[0]);
  const speed = points.filter(([,p]) => p.speed != null).map(([t,p]) => [t,p.speed!] as [number,number]);
  const hearts = points.filter(([,p]) => p.hr != null).map(([t,p]) => [t,p.hr!] as [number,number]);
  if (speed.length < 2) return fail('No hay suficientes muestras de velocidad.');
  const edgeSeconds = speed[0][0] + elapsed-speed.at(-1)![0];
  if (speed[0][0] > 30 || elapsed-speed.at(-1)![0] > 30 || edgeSeconds > elapsed * .02) return fail('Faltan demasiadas muestras en los extremos para ubicar los kilómetros o intervalos.');
  if (speed[0][0] > 0) speed.unshift([0,speed[0][1]]);
  if (speed.at(-1)![0] < elapsed) speed.push([elapsed,speed.at(-1)![1]]);
  const ranges = (a: number, b: number): [number,number][] => {
    let cursor = a;
    const result: [number,number][] = [];
    for (const [p,q] of pauses) {
      if (q <= cursor || p >= b) continue;
      if (p > cursor) result.push([cursor,p]);
      cursor = Math.max(cursor,q);
    }
    if (cursor < b) result.push([cursor,b]);
    return result;
  };
  type Slice = { from: number; to: number; v0: number; v1: number; seconds: number; meters: number };
  const slices: Slice[] = [];
  let gapSeconds = 0;
  for (let i=1;i<speed.length;i++) {
    const [a,v0] = speed[i-1], [b,v1] = speed[i];
    const validRanges = ranges(a,b);
    const observedSeconds = validRanges.reduce((sum,[p,q]) => sum+q-p,0);
    if (b-a > 30) gapSeconds += observedSeconds;
    if (config.clock === 'observed' && b-a>30) continue;
    if (observedSeconds > 120) return fail('Hay un hueco de más de dos minutos sin velocidad ni pausas verificadas. Prueba tiempo observado (aproximado) o indica las pausas reales.');
    for (const [p,q] of validRanges) {
      const x = v0+(v1-v0)*(p-a)/(b-a), y = v0+(v1-v0)*(q-a)/(b-a);
      slices.push({ from:p,to:q,v0:x,v1:y,seconds:q-p,meters:(x+y)*(q-p)/2 });
    }
  }
  const integrated = slices.reduce((sum,s) => sum+s.meters,0);
  const observedTime = slices.reduce((sum,s) => sum+s.seconds,0);
  if (config.clock === 'observed' && (activeSeconds == null || activeSeconds <= 0 || Math.abs(observedTime-activeSeconds) > Math.max(10,activeSeconds*.02)))
    return fail('El tiempo observado no concuerda con la duración original (margen 2 %). Indica pausas reales para poder situar los bloques.');
  if (integrated <= 0 || distance == null || distance <= 0 || !Number.isFinite(distance) || Math.abs(integrated-distance)/distance > .05)
    return fail('La distancia de las muestras difiere más del 5 % del total. No se pueden situar los bloques con suficiente fiabilidad.');
  const scale = distance/integrated;
  const definitions = config.mode === 'kilometres'
    ? Array.from({length: Math.ceil(distance/1000)}, (_,i) => ({label: i*1000+1000<=distance ? `Km ${i+1}` : 'Tramo final',basis:'distance' as const,value:Math.min(1000,distance-i*1000)}))
    : config.blocks;
  if (!definitions.length || definitions.length > 500 || definitions.some(b => !b.label.trim() || !['time','distance'].includes(b.basis) || !Number.isFinite(b.value) || b.value <= 0)) return fail('Indica una estructura con bloques y cantidades válidas.');
  const result: AnalysisResult = { blocks:[],scale,edgeSeconds,gapSeconds };
  let index = 0, offset = 0, heartIndex = 1;
  for (const block of definitions) {
    let remaining = block.value, seconds = 0, meters = 0, hrIntegral = 0, hrSeconds = 0;
    while (remaining > 1e-5 && index < slices.length) {
      const s = slices[index], acceleration = (s.v1-s.v0)/s.seconds;
      const currentSpeed = s.v0+acceleration*offset;
      const availableTime = s.seconds-offset;
      const availableMeters = (currentSpeed+s.v1)*availableTime/2*scale;
      let dt: number;
      if (block.basis === 'time') dt = Math.min(remaining,availableTime);
      else if (availableMeters <= remaining+1e-6) dt = availableTime;
      else {
        const target = remaining/scale;
        const root = Math.sqrt(Math.max(0,currentSpeed*currentSpeed+2*acceleration*target));
        dt = Math.min(availableTime,2*target/(currentSpeed+root));
      }
      const dm = (currentSpeed+currentSpeed+acceleration*dt)*dt/2*scale;
      const from = s.from+offset, to = from+dt;
      while (heartIndex < hearts.length && hearts[heartIndex][0] <= from) heartIndex++;
      for (let j=heartIndex;j<hearts.length;j++) {
        const [a,h0] = hearts[j-1], [b,h1] = hearts[j];
        if (b < from) continue;
        if (a >= to) break;
        const p = Math.max(a,from), q = Math.min(b,to);
        if (q<=p || b-a>30) continue;
        hrIntegral += (h0+(h1-h0)*((p+q)/2-a)/(b-a))*(q-p);
        hrSeconds += q-p;
      }
      seconds += dt; meters += dm;
      remaining -= block.basis === 'time' ? dt : dm;
      offset += dt;
      if (offset >= s.seconds-1e-7) {index++;offset=0;}
    }
    if (remaining > .01) return fail(`Las muestras terminan antes de completar «${block.label}». Revisa la estructura y las pausas.`);
    result.blocks.push({ label:block.label,seconds,distance:meters,heartRate:hrSeconds>0 && hrSeconds>=seconds*.8 ? hrIntegral/hrSeconds : null });
  }
  return result;
}
