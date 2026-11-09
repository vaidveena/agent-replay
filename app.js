import {scenarios,createRun,transition,runUntilPause,isTerminal,exportTrace} from './engine.js';
const $ = id => document.getElementById(id);
let run;
function node(tag,text,cls){const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;}
for(const [id,s] of Object.entries(scenarios)) {const o=node('option',s.name);o.value=id;$('scenario').append(o);}
function render(){
  $('state').textContent=run.state.replaceAll('_',' ');$('usage').textContent=`${run.calls} / ${run.maxCalls}`;$('attempts').textContent=run.attempts;
  $('lesson').textContent=scenarios[run.scenarioId].lesson;
  $('approval').hidden=run.state!=='awaiting_approval';$('summary').textContent=run.summary;
  const paused=isTerminal(run)||run.state==='awaiting_approval';$('step').disabled=paused;$('run').disabled=paused;
  $('trace').replaceChildren();
  if(!run.events.length)$('trace').append(node('p','Your trace starts here. Step forward to inspect the proposed tool call.','empty'));
  for(const e of run.events){const item=node('article','','event');const meta=node('div','','event-meta');meta.append(node('span',String(e.number).padStart(2,'0')),node('span',e.kind.toUpperCase()));item.append(meta,node('p',e.message));if(e.data!==null)item.append(node('pre',JSON.stringify(e.data,null,2)));$('trace').append(item);}
  $('message').textContent=({completed:'Simulation complete. Inspect the validated result and the explicit approval in your trace.',failed:'Stopped safely. Review the final event to understand the failure.',cancelled:'Simulation cancelled. No simulated write executed.',awaiting_approval:'Paused for your decision.'})[run.state]||'';
}
function reset(){run=createRun($('scenario').value,{maxCalls:Number($('calls').value),maxRetries:Number($('retries').value)});render();}
function act(action){try{run=transition(run,action);render();}catch(e){$('message').textContent=e.message;}}
$('step').onclick=()=>act('step');$('approve').onclick=()=>act('approve');$('reject').onclick=()=>act('reject');
$('run').onclick=()=>{try{run=runUntilPause(run);render();}catch(e){$('message').textContent=e.message;}};
$('reset').onclick=reset;for(const id of ['scenario','calls','retries'])$(id).onchange=reset;
$('export').onclick=()=>{const url=URL.createObjectURL(new Blob([exportTrace(run)],{type:'application/json'}));const a=node('a','');a.href=url;a.download='agent-replay-trace.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
reset();
