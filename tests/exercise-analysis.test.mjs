import test from 'node:test';
import assert from 'node:assert/strict';
import { analyseExercise } from '../lib/exercise-analysis.ts';
const config = {mode:'kilometres',clock:'elapsed',blocks:[]};
const trace = (end) => Array.from({length:end+1},(_,t)=>[t,2,100+t/20]);

test('speed and heart samples may be separate; kilometre heart rates remain distinct',()=>{
  const points = trace(1000).flatMap(([t,v,h])=>[[t,v,null],[t,null,h]]);
  const result=analyseExercise(points,1000,2000,config);
  assert.equal(result.error,undefined);
  assert.equal(result.blocks.length,2);
  assert.equal(result.blocks[0].seconds,500);
  assert.ok(Math.abs(result.blocks[0].heartRate-112.5)<1e-6);
  assert.ok(Math.abs(result.blocks[1].heartRate-137.5)<1e-6);
});
test('mixed distance/time blocks integrate speed instead of copying global pace',()=>{
  const result=analyseExercise(trace(1200),1200,2400,{mode:'intervals',clock:'elapsed',blocks:[
    {label:'Warmup',basis:'distance',value:1000},
    {label:'Work 1',basis:'time',value:120},
    {label:'Recovery',basis:'time',value:60},
    {label:'Cooldown',basis:'distance',value:1040},
  ]});
  assert.equal(result.error,undefined);
  assert.deepEqual(result.blocks.map(b=>Math.round(b.distance)),[1000,240,120,1040]);
  assert.deepEqual(result.blocks.map(b=>b.seconds),[500,120,60,520]);
});
test('three eight-minute work blocks retain their own measured distance and recovery rows',()=>{
  const blocks=[{label:'Warmup',basis:'distance',value:2000},
    ...[1,2,3].flatMap(i=>[{label:`Work ${i}`,basis:'time',value:480},{label:`Recovery ${i}`,basis:'time',value:120}]),
    {label:'Cooldown',basis:'distance',value:3000}];
  const points=Array.from({length:3801},(_,t)=>[t,2.5,150]);
  const result=analyseExercise(points,3800,9500,{mode:'intervals',clock:'observed',blocks},[],3800);
  assert.equal(result.error,undefined);
  assert.equal(result.blocks.length,8);
  for (const block of result.blocks.filter(b=>b.label.startsWith('Work'))) {
    assert.ok(Math.abs(block.seconds-480)<1e-6);
    assert.ok(Math.abs(block.distance-1200)<1e-6);
    assert.equal(block.heartRate,150);
  }
});
test('active clock refuses to place unreported pauses from total duration alone',()=>{
  const result=analyseExercise(trace(1000),1000,2000,{...config,clock:'active'});
  assert.match(result.error,/pausas del reloj/);
});
test('verified pauses remove time from interval boundaries and heart means',()=>{
  const points=trace(1200).map(([t,v,h])=>[t,t>=500&&t<=700?0:v,h]);
  const result=analyseExercise(points,1200,2000,{...config,clock:'active'},[[500,700]]);
  assert.equal(result.error,undefined);
  assert.equal(result.blocks.length,2);
  assert.ok(Math.abs(result.blocks.reduce((s,b)=>s+b.seconds,0)-1000)<1e-6);
});
test('observed clock excludes long gaps only when duration and distance fit',()=>{
  const points=[...trace(500),...trace(500).map(([t,v,h])=>[t+800,v,h])];
  const result=analyseExercise(points,1300,2000,{...config,clock:'observed'},[],1000);
  assert.equal(result.error,undefined);
  assert.equal(result.gapSeconds,300);
  assert.equal(result.blocks[0].seconds,500);
  assert.equal(result.blocks[1].seconds,500);
  assert.match(analyseExercise(points,1300,2000,{...config,clock:'observed'},[],700).error,/tiempo observado/);
  assert.match(analyseExercise(points,1300,2000,config).error,/hueco/);
});
test('missing traces, inconsistent distances and too-long structures produce no fabricated blocks',()=>{
  assert.match(analyseExercise([],1000,2000,config).error,/sincronizar/);
  assert.match(analyseExercise(trace(1000),1000,4000,config).error,/5 %/);
  const r=analyseExercise(trace(1000),1000,2000,{mode:'intervals',clock:'elapsed',blocks:[{label:'Work',basis:'time',value:2000}]});
  assert.equal(r.blocks.length,0);
  assert.match(r.error,/terminan antes/);
});
test('missing heart coverage does not borrow the whole workout mean',()=>{
  const r=analyseExercise(trace(1000).map(([t,v])=>[t,v,null]),1000,2000,config);
  assert.ok(r.blocks.every(b=>b.heartRate===null));
});
