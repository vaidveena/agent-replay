import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,transition,runUntilPause,validCall,validResult,exportTrace,scenarios,isTerminal} from '../engine.js';

test('happy path pauses before writing and completes only after approval',()=>{
  const paused=runUntilPause(createRun());assert.equal(paused.state,'awaiting_approval');assert.equal(paused.calls,1);
  assert.equal(transition(paused),paused);
  const done=runUntilPause(transition(paused,'approve'));assert.equal(done.state,'completed');assert.equal(done.calls,2);
});
test('declining prevents the simulated write',()=>{
  const run=transition(runUntilPause(createRun()),'reject');assert.equal(run.state,'cancelled');assert.equal(run.calls,1);
  assert.equal(transition(run),run);
});
test('approval outside a pending decision is rejected',()=>{
  assert.throws(()=>transition(createRun(),'approve'),/pending approval/);
});
test('transitions preserve previous snapshots',()=>{
  const old=createRun();const next=transition(old);assert.equal(old.state,'ready');assert.equal(old.events.length,0);assert.equal(next.events.length,1);
});
test('one timeout recovers with a bounded retry',()=>{
  const paused=runUntilPause(createRun('recovery'));assert.equal(paused.attempts,2);assert.equal(paused.calls,2);
  const done=runUntilPause(transition(paused,'approve'));assert.equal(done.state,'completed');assert.equal(done.calls,3);
});
test('repeated timeouts stop and do not request approval',()=>{
  const run=runUntilPause(createRun('exhausted'));assert.equal(run.state,'failed');assert.equal(run.attempts,2);assert.equal(run.result,null);
});
test('zero retries means one attempt',()=>{
  const run=runUntilPause(createRun('recovery',{maxRetries:0}));assert.equal(run.state,'failed');assert.equal(run.calls,1);
});
test('malformed or forbidden calls never execute',()=>{
  for(const id of ['badArguments','forbidden']){const run=runUntilPause(createRun(id));assert.equal(run.state,'failed');assert.equal(run.calls,0);}
});
test('malformed output fails after read without publication',()=>{
  const run=runUntilPause(createRun('badResult'));assert.equal(run.state,'failed');assert.equal(run.calls,1);assert.equal(run.summary,'');
});
test('a one-call budget permits lookup but prevents publication',()=>{
  const paused=runUntilPause(createRun('healthy',{maxCalls:1}));
  const run=runUntilPause(transition(paused,'approve'));assert.equal(run.state,'failed');assert.equal(run.calls,1);
});
test('budgets hold across every scenario and configuration',()=>{
  for(const id of Object.keys(scenarios))for(let maxCalls=1;maxCalls<=5;maxCalls++)for(let maxRetries=0;maxRetries<=2;maxRetries++){
    let run=runUntilPause(createRun(id,{maxCalls,maxRetries}));
    if(run.state==='awaiting_approval')run=runUntilPause(transition(run,'approve'));
    assert.ok(isTerminal(run));assert.ok(run.calls<=maxCalls);assert.ok(run.attempts<=maxRetries+1);
    if(run.state==='completed')assert.equal(run.approved,true);
  }
});
test('contracts reject contradictions and extra fields',()=>{
  assert.equal(validCall({tool:'lookup_ticket',arguments:{ticket_id:'DEMO-42',admin:true}}),false);
  for(const value of [null,{status:'ready',blockers:2},{status:'blocked',blockers:0},{status:'ready',blockers:0,extra:'x'}])assert.equal(validResult(value),false);
});
test('invalid run settings fail explicitly',()=>{
  for(const settings of [{maxCalls:0},{maxCalls:6},{maxRetries:-1},{maxRetries:3}])assert.throws(()=>createRun('healthy',settings));
  assert.throws(()=>createRun('missing'));assert.throws(()=>transition(createRun(),'unknown'));
});
test('export marks simulation and preserves event order',()=>{
  const run=runUntilPause(createRun());const output=JSON.parse(exportTrace(run));assert.equal(output.simulation,true);
  assert.deepEqual(output.events.map(e=>e.number),run.events.map((_,i)=>i+1));
});
