import {createRun,runUntilPause,transition} from './engine.js';
const cases=[['healthy','completed',2],['recovery','completed',3],['exhausted','failed',2],['badArguments','failed',0],['badResult','failed',1],['forbidden','failed',0]];
let passed=0;
for(const [id,expected,calls]of cases){
  let run=runUntilPause(createRun(id));
  if(run.state==='awaiting_approval')run=runUntilPause(transition(run,'approve'));
  const ok=run.state===expected&&run.calls===calls;
  passed+=Number(ok);console.log(`${ok?'PASS':'FAIL'} ${id}: ${run.state}, ${run.calls} tool calls`);
}
console.log(`${passed}/${cases.length} scripted workflow expectations matched. This does not measure model or agent quality.`);
if(passed!==cases.length)process.exitCode=1;
