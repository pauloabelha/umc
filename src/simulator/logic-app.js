import {mountComponentBrowser} from './component-browser.js';
import './style.css';
import {logicGates} from '../logic/gates.js';
import {makeLogicExperiment} from '../logic/circuit.js';
import {createLogicSession} from '../logic/session.js';
import {experimentScene} from './catalog.js';
import {createView} from './view.js';
import {renderComposition} from './composition-view.js';

const $=id=>document.getElementById(id),view=createView($('viewport'));
for(const g of [...logicGates,{id:'half-adder',name:'Half-adder · XOR + AND'}])$('logic-gate').add(new Option(g.name,g.id));
const selectBrowser=mountComponentBrowser();
const params=new URLSearchParams(location.search);
for(const [id,key] of [['logic-gate','gate'],['logic-mode','mode'],['input-a','a'],['input-b','b'],['logic-scale','scale']]) {
 const value=params.get(key);if([...$(id).options].some(o=>o.value===value))$(id).value=value;
}
let experiment,session,running=false,busy=false,failed=false,lastFrame=0,historyLength=0;
const settings=['logic-gate','input-a','input-b','logic-mode','logic-scale'];
function controls() {
 for(const id of settings)$(id).disabled=busy||running;
 $('logic-run').disabled=busy&&!running||failed;
 $('logic-run').textContent=running?'Pause':'Run';
 $('logic-step').disabled=busy||running||failed;
 $('logic-reset').disabled=busy;
}
function fail(error){running=false;failed=true;$('logic-error').hidden=false;$('logic-error').textContent=error.message;$('logic-status').textContent='Error';}
function row(values){const tr=document.createElement('tr');for(const value of values){const td=document.createElement('td');td.textContent=value;tr.append(td);}return tr;}
function draw(state) {
 view.update({...state.current,componentStates:state.componentStates});
 $('logic-location').textContent=state.current.component??'—';
 $('logic-time').textContent=`${state.current.time.toFixed(2)} s`;
 $('logic-laps').textContent=state.current.laps??0;
 const completed=state.logic.completed,last=completed.at(-1),live=state.logic.outputs;
 // Half-adder outputs are committed together; never mix two different laps.
 const outputs=experiment.half?last?.outputs:(live[experiment.entry.id]?live:last?.outputs);
 $('logic-output').textContent=outputs?.[experiment.half?'xor':experiment.entry.id]?.value??'—';
 $('logic-carry').textContent=outputs?.and?.value??'—';
 $('logic-observation').textContent=last?`Lap ${last.lap} complete: ${Object.values(last.outputs).map(o=>`${o.rail} → ${o.value}`).join(' · ')}`:experiment.half?'Waiting for a complete Sum/Carry evaluation.':'Waiting for the marble to cross an output track.';
 if(completed.length!==historyLength||completed.at(-1)?.lap!==Number($('logic-history').dataset.lap)) {
   $('logic-history').replaceChildren(...completed.slice(-12).reverse().map(item=>row([item.lap,`${item.time.toFixed(2)} s`,Object.values(item.outputs).map(o=>o.rail).join(' → '),experiment.half?`Sum ${item.outputs.xor.value}, Carry ${item.outputs.and.value}`:item.outputs[experiment.entry.id].value])));
   historyLength=completed.length;$('logic-history').dataset.lap=last?.lap??0;
 }
}
async function reset() {
 running=false;busy=true;failed=false;controls();$('logic-error').hidden=true;
 $('logic-status').textContent='Loading…';
 $('logic-output').textContent=$('logic-carry').textContent='—';
 $('logic-laps').textContent='0';$('logic-time').textContent='0 s';
 $('logic-history').replaceChildren();historyLength=-1;
 $('logic-observation').textContent='Waiting for the marble to cross an output track.';
 try {
   const previous=session;session=null;
   // A lost GPU connection must not prevent the user's explicit switch to CPU
   // or Semantic. dispose stops the lease locally; an unreachable world expires.
   try{await previous?.dispose();}catch(error){console.warn('Previous logic session cleanup:',error.message);}
   const gate=$('logic-gate').value,a=Number($('input-a').value),b=Number($('input-b').value),scale=Number($('logic-scale').value);
   experiment=makeLogicExperiment({gate,a,b,scale});
   selectBrowser(gate);
   const spec=logicGates.find(g=>g.id===gate),half=experiment.half;
   $('input-b-field').hidden=spec?.inputs===1;$('carry-readout').hidden=!half;$('adder-sequence').hidden=!half;
   $('output-label').textContent=half?'Sum':'Output Y';$('logic-title').textContent=experiment.entry.label;
   $('logic-formula').textContent=half?'Sum = A ⊕ B · Carry = A ∧ B':spec.expression;
   $('truth-head').replaceChildren(row(half?['A','B','Sum','Carry']:spec.inputs===1?['A','Y']:['A','B','Y']));
   const rows=[];
   for(let x=0;x<2;x++)for(let y=0;y<(spec?.inputs===1?1:2);y++) {
     const tr=row(half?[x,y,logicGates.find(g=>g.id==='xor').rails[2*x+y],logicGates.find(g=>g.id==='and').rails[2*x+y]]:spec.inputs===1?[x,spec.rails[2*x]]:[x,y,spec.rails[2*x+y]]);
     if(x===a&&(spec?.inputs===1||y===b))tr.className='active-instruction';rows.push(tr);
   }
   $('truth-body').replaceChildren(...rows);
   view.load({...experimentScene(experiment),cameraOffset:[0,.65,.8],labels:experiment.labels.map(label=>({...label,position:label.position.map(v=>v*scale)}))});
   renderComposition($('composition-tree'),experiment.circuit.composition,id=>view.highlight(id));
   session=await createLogicSession(experiment,$('logic-mode').value);historyLength=-1;draw(session.snapshot());
   $('logic-status').textContent='Ready';
   const url=new URL(location.href);for(const [key,value] of Object.entries({gate,a,b,scale,mode:$('logic-mode').value}))url.searchParams.set(key,value);history.replaceState(null,'',url);
 }catch(error){fail(error);}finally{busy=false;controls();}
}
async function step(){if(busy||failed)return;busy=true;controls();try{draw(await session.step());$('logic-status').textContent=running?'Running':'Paused';}catch(error){fail(error);}finally{busy=false;controls();}}
for(const id of settings)$(id).onchange=()=>void reset();
$('logic-reset').onclick=()=>void reset();$('logic-step').onclick=()=>void step();
$('logic-run').onclick=()=>{running=!running;lastFrame=0;$('logic-status').textContent=running?'Running':'Paused';controls();};
function frame(now){if(running&&!busy&&now-lastFrame>=($('logic-mode').value==='semantic'?120:1000/60)){lastFrame=now;void step();}requestAnimationFrame(frame);}
window.addEventListener('pagehide',()=>{running=false;void session?.dispose().catch(()=>{});});
void reset();requestAnimationFrame(frame);
