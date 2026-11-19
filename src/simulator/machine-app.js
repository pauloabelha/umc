import {LatticeMachineExecution} from '../machine/lattice-execution.js';
import './style.css';
import {IncJumpMachine} from '../machine/inc-jump.js';
import {GateMachine} from '../machine/gate-machine.js';
const $=id=>document.getElementById(id);
let machine=new IncJumpMachine(),timer=null;
const instructionText=i=>i.op==='INC'?`INC(${i.register})`:`JUMP(${i.target})`;
const gateMode=()=>$('machine-backend').value!=='reference';
const latticeMode=()=>$('machine-backend').value==='lattice';
function row(values) {
  const tr=document.createElement('tr');
  for(const value of values){const td=document.createElement('td');td.textContent=value;tr.append(td);}
  return tr;
}
function controls() {
  const running=timer!==null,halted=!!machine.snapshot().halt;
  $('machine-run').textContent=running?'Pause':'Run';$('machine-run').disabled=halted;
  $('machine-step').disabled=running||halted;
  $('machine-microstep').disabled=running||halted||!gateMode();
  for(const id of ['machine-speed','machine-backend'])$(id).disabled=running;
  $('machine-width').disabled=running||!gateMode();
  document.querySelector('#machine-width option[value="16"]').disabled=latticeMode();
}
function render() {
  const state=machine.snapshot();
  for(const name of ['a','b'])$(`register-${name}`).textContent=state.registers[name];
  $('pc').textContent=state.pc;
  $('machine-time').textContent=`${state.time.toFixed(3)} s`;
  $('machine-program').replaceChildren(...state.instructions.map(instruction=>{
    const tr=row([instruction.address,instructionText(instruction),instruction.status,instruction.executions]);
    tr.classList.toggle('active-instruction',instruction.address===state.pc);
    if(instruction.address===state.pc)tr.setAttribute('aria-current','step');
    return tr;
  }));
  $('machine-log').replaceChildren(...machine.trace(100).reverse().map(event=>
    row([`${event.step} / ${event.time.toFixed(3)} s`,`${event.instruction}: ${instructionText(event)}`,event.next,
      `${event.before.a} → ${event.after.a}`,`${event.before.b} → ${event.after.b}`])));
  $('gate-details').hidden=!gateMode();
  $('machine-boundary').textContent=latticeMode()
    ?'Primitive component circuit · Every transfer follows aligned ports through tracks, Ferris wheels, receiving junctions and T-gates. This view executes its semantics; use the component simulator for physical execution. Dimensions remain estimates. Stops on finite-register overflow.'
    :gateMode()
    ?'Semantic T-gate wiring · Bits change through T-gate passages. Finite registers stop on overflow. The full lattice layout, transport, merges, lifts and collision-driven switches are not implemented. One logical node passage costs one virtual second at 1×; transport costs are not included.'
    :'Instruction reference · Exact nonnegative integers, no physical capacity. Each instruction costs one virtual second at 1×. This model supplies the expected result for checking the gate implementation.';
  if(gateMode()) {
    $('gate-location').textContent=state.location;
    $('gate-states').replaceChildren(...Object.entries(state.gates).map(([id,value])=>row([id,Number(value==='right'),id===state.location?'marble here':id==='a-return'?`next return: ${value==='left'?2:6}`:'stored'])));
    $('gate-trace').textContent=machine.componentTrace(30).map(e=>`${e.time.toFixed(3)}  ${e.from} [${e.output}] → ${e.to}${e.transition?` | ${e.transition.before} → ${e.transition.after}`:''}`).join('\n');
  }
  controls();
}
function pause() {
  clearInterval(timer);timer=null;controls();
  $('machine-status').textContent=machine.snapshot().halt??'Paused';
}
function advance(micro=false) {
  const state=micro?machine.stepComponent():machine.step();
  if(state.halt)pause();
  render();
  $('machine-status').textContent=state.halt??(timer===null?'Paused':'Running');
}
$('machine-step').onclick=()=>advance();
$('machine-microstep').onclick=()=>advance(true);
$('machine-run').onclick=()=>{
  if(timer!==null){pause();return;}
  timer=setInterval(()=>advance(gateMode()),Number($('machine-playback').value));
  controls();$('machine-status').textContent='Running';
};
$('machine-playback').onchange=()=>{
  if(timer!==null){clearInterval(timer);timer=setInterval(()=>advance(gateMode()),Number($('machine-playback').value));}
};
function reset() {
  pause();
  if(latticeMode()&&Number($('machine-width').value)>8)$('machine-width').value='8';
  const options={speed:Number($('machine-speed').value),bits:Number($('machine-width').value)};
  machine=latticeMode()?new LatticeMachineExecution(options):gateMode()?new GateMachine(options):new IncJumpMachine(options);
  render();$('machine-status').textContent='Ready';
}
$('machine-reset').onclick=reset;
for(const id of ['machine-speed','machine-backend','machine-width'])$(id).onchange=reset;
$('machine-download').onclick=()=>{
  const data=gateMode()?{instructions:machine.trace(),components:machine.componentTrace(),state:machine.snapshot()}:machine.trace();
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='umc-inc-jump-log.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
window.addEventListener('pagehide',pause);
render();
