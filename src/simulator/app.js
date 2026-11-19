import {renderComposition} from './composition-view.js';
import {registerValue} from '../machine/increment-register.js';
import './style.css';
import {catalog, makeExperiment, experimentScene} from './catalog.js';
import {createSession} from './session.js';
import {createView} from './view.js';
import {gpuClient} from '../backends/gpu.js';

const localGPU = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const defaultMode = localGPU ? 'gpu' : 'semantic';
const $ = id => document.getElementById(id);
for (const item of catalog) $('component').add(new Option(item.label,item.id));
for (const item of catalog) {
  const card = document.createElement('a');
  card.href = `/simulator/?component=${item.id}&mode=${defaultMode}`;
  card.className = 'component-card'; card.dataset.component = item.id;
  card.innerHTML = `<span class="card-kind">${item.kind}</span><span class="track-sketch" aria-hidden="true">${'<i></i>'.repeat(Math.min(item.count,4))}<b></b></span><strong>${item.label}</strong><span class="card-description">${item.description}</span><span class="card-meta">${item.count} piece${item.count > 1 ? 's' : ''} · ${item.modes?'semantic · layout preview':'semantic / physical'}</span>`;
  card.onclick = event => {
    if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    event.preventDefault();
    if(!busy&&!running){
      $('component').value=item.id;
      $('mode').value=defaultMode;
      void reset({historyMode:'push'}).then(()=>document.querySelector('.workspace').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'}));
    }
  };
  $('gallery').append(card);
}
function readLocation() {
  const params=new URLSearchParams(location.search);
  const component=params.get('component');
  $('component').value=catalog.some(item=>item.id===component)?component:'seven-instruction-lattice';
  const entry=catalog.find(item=>item.id===$('component').value);
  const defaults={mode:defaultMode,scale:'1',speed:'1',playback:'follow'};
  for(const [id,fallback] of Object.entries(defaults)) {
    const requested=params.get(id);
    $(id).value=[...$(id).options].some(option=>option.value===requested)?requested:fallback;
  }
  const duration=Number(params.get('duration')??1);
  $('duration').value=Number.isFinite(duration)&&duration>=.1&&duration<=30?String(duration):'1';
}
function syncLocation(historyMode='replace') {
  const url=new URL(location.href);
  for(const id of ['component','mode','scale','speed','duration','playback']) {
    const value=$(id).value;
    if(['scale','speed','duration'].includes(id)&&value==='1'||id==='playback'&&value==='follow')url.searchParams.delete(id);
    else url.searchParams.set(id,value);
  }
  if(url.href!==location.href)history[historyMode==='push'?'pushState':'replaceState'](null,'',url);
}
readLocation();
const inputs = ['component', 'mode', 'scale', 'speed', 'duration'];
const client = gpuClient();
let view, experiment, session, running = false, busy = false, finished = false;
let lastFrame = 0, nextSemanticStepAt = 0;
const canRepeatGate=()=>experiment?.entry.id==='t-gate'&&session?.snapshot().result?.status==='exited';
function controls() {
  for (const id of inputs) $(id).disabled = running || busy;
  $('playback').disabled = $('mode').value !== 'semantic';
  $('speed').disabled ||= $('mode').value !== 'semantic';
  $('duration').disabled ||= $('mode').value !== 'semantic';
  const unavailable=experiment&&!experiment.circuit.physicalSupported&&$('mode').value!=='semantic';
  $('run').disabled = (busy && !running)||unavailable;
  $('run').textContent = running ? 'Pause' : finished ? (canRepeatGate()?'Send marble again':'Run again') : 'Run';
  $('step').disabled = busy || running || finished || unavailable;
  $('reset').disabled = busy;
  $('inspect-time').disabled = busy || running || Number($('inspect-time').max) === 0;
  for (const card of document.querySelectorAll('.component-card')) card.setAttribute('aria-disabled',String(busy||running));
}
function fail(error) {
  running = false;
  $('error').hidden = false;
  $('error').textContent = `${error.message}. Reset to try again.`;
  $('status').textContent = 'Error';
  finished = true;
}
function showTracking(time, inspecting = false) {
  if (!session || $('mode').value !== 'semantic') return;
  const marble = session.locateMarble(experiment.marble.id, time);
  view.highlight(marble.component);
  const instruction=experiment.registerBanks
    ?session.marbleHistory(marble.id).findLast(visit=>visit.enteredAt<=time&&/^i[1-7]$/.test(visit.component))?.component
    :marble.component;
  renderProgram(instruction,inspecting);
  $('tracking-clock').textContent = `${inspecting ? 'Inspecting' : 'Live'} · ${time.toFixed(3)} s`;
  const row = document.createElement('tr');
  for (const value of [marble.id, marble.component ? `${experiment.circuit.componentName(marble.component)}.${marble.component}` : `Exited ${experiment.circuit.componentName(marble.lastComponent)}.${marble.lastComponent}`, marble.status, `${marble.elapsed.toFixed(3)} s`]) {
    const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
  }
  $('marble-rows').replaceChildren(row);
  const rows = session.marbleHistory(marble.id).map(visit => {
    const row = document.createElement('tr');
    for (const value of [`${experiment.circuit.componentName(visit.component)}.${visit.component}`, `${visit.enteredAt.toFixed(3)} s`, visit.exitedAt === null ? '—' : `${visit.exitedAt.toFixed(3)} s`]) {
      const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
    }
    return row;
  });
  $('visit-rows').replaceChildren(...rows);
  renderLog();
  if (inspecting) view.update(marble);
}
function renderLog() {
  if(!session?.traceEvents)return;
  const colors={StraightTrack:'teal',Curve90:'red',Ramp:'yellow',FerryElevator:'blue',LatticeElevator:'blue',TGate:'purple',ReturnTrack:'teal',CarryTrack:'teal',CompletionTrack:'teal',CompletionMerge:'yellow',Merge:'yellow'};
  const rows=session.traceEvents({limit:100}).map(event=>{
    const row=document.createElement('div');row.className='log-row';
    const time=document.createElement('span');time.className='log-time';time.textContent=`t=${event.time.toFixed(3)}`;row.append(time);
    const marble=document.createElement('span');marble.className='log-marble';marble.textContent=event.marble;row.append(marble);
    for(const endpoint of [event.from,event.to]) {
      if(endpoint===event.from&&!endpoint)continue;
      const arrow=document.createElement('span');arrow.className='log-arrow';arrow.textContent='→';row.append(arrow);
      const label=document.createElement('span');label.className=`log-component ${colors[endpoint?.name]??'neutral'}`;
      label.textContent=endpoint?`${endpoint.name}.${endpoint.component}`:'EXIT';row.append(label);
      if($('verbose-log').checked&&endpoint){const port=document.createElement('span');port.className='log-port';port.textContent=`[${endpoint.port}]`;row.append(port);}
    }
    if($('verbose-log').checked&&event.duration!==undefined){const duration=document.createElement('span');duration.className='log-duration';duration.textContent=`${event.duration.toFixed(3)} virtual s`;row.append(duration);}
    if(event.transition){const state=document.createElement('span');state.className='log-state';state.textContent=`state ${event.transition.before} → ${event.transition.after}`;row.append(state);}
    return row;
  });
  const log=$('execution-log'),follow=log.scrollTop+log.clientHeight>=log.scrollHeight-30;
  log.replaceChildren(...rows);if(follow)log.scrollTop=log.scrollHeight;
}
$('verbose-log').onchange=renderLog;
$('download-log').onclick=()=>{
  if(!session?.traceText)return;
  const url=URL.createObjectURL(new Blob([session.traceText()+'\n'],{type:'text/plain'}));
  const a=document.createElement('a');a.href=url;a.download='umc-computation.log';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('inspect-time').oninput = () => showTracking(Number($('inspect-time').value), true);
function show(snapshot) {
  view.update({...snapshot.current,componentStates:snapshot.componentStates});
  $('gate-state').textContent=gateReadout(snapshot.componentStates);
  if ($('mode').value === 'semantic') {
    $('inspect-time').max = String(snapshot.current.time);
    $('inspect-time').value = String(snapshot.current.time);
    showTracking(snapshot.current.time);
  } else {
    view.highlight(snapshot.current.component);
    renderProgram(snapshot.current.instruction??experiment.instance.id);
  }
  $('elapsed').textContent = `${snapshot.current.time.toFixed(3)} s`;
  $('output').textContent = experiment.entry.closed ? `${snapshot.current.laps ?? 0} ${(snapshot.current.laps ?? 0) === 1 ? 'lap' : 'laps'}` : snapshot.result?.output ?? '—';
  if (snapshot.result) {
    finished = true; running = false;
    const overflow=experiment.overflowPorts?.some(p=>p.component===snapshot.result.component&&p.port===snapshot.result.output);
    $('status').textContent = overflow?'Register overflow':snapshot.result.status === 'exited' ? 'Completed' : snapshot.result.status;
  } else $('status').textContent = running ? 'Running' : 'Paused';
}
async function reset({historyMode='replace'}={}) {
  running = false; busy = true; controls();
  try {
    await session?.dispose(); session = null;
    const entry=catalog.find(item=>item.id===$('component').value);
    for(const option of $('mode').options)option.disabled=false;
    if (!$('duration').checkValidity()) throw new Error('Expected duration must be between 0.1 and 30 seconds');
    experiment = makeExperiment({component: $('component').value, scale: Number($('scale').value),
      speed: Number($('speed').value), expectedDuration: Number($('duration').value)});
    view.load(experimentScene(experiment));
    view.highlight(experiment.instance.id);
    renderComposition($('composition-tree'),experiment.circuit.composition,id=>view.highlight(id));
    finished = false;
    $('tracking').hidden = $('mode').value !== 'semantic';
    renderProgram(experiment.instance.id);
    $('inspect-time').max = $('inspect-time').value = '0';
    if ($('mode').value === 'semantic') {
      session = await createSession(experiment, 'semantic');
      showTracking(0);
      const snapshot=session.snapshot();
      view.update({...snapshot.current,componentStates:snapshot.componentStates});
    }
    $('gate-state').textContent=gateReadout(session?.snapshot().componentStates);
    $('prototype-note').hidden=experiment.circuit.physicalSupported;
    $('physics-availability').hidden=experiment.circuit.physicalSupported;
    $('physics-availability').textContent='CPU/GPU are unavailable for this model because its physical mechanisms are unfinished. GPU service status is shown below.';
    $('status').textContent = !experiment.circuit.physicalSupported&&$('mode').value!=='semantic'?'Physical model unavailable':'Ready'; $('elapsed').textContent = '0.000 s'; $('output').textContent = '—';
    $('target').previousElementSibling.textContent=experiment.targetLabel??'Semantic target';
    $('target').textContent = `${experiment.expectedDuration.toFixed(3)} s`;
    $('stage-title').textContent = `${experiment.entry.label} · Level ${experiment.circuit.level}`;
    $('path-label').textContent = experiment.pathLabel ?? (experiment.circuit.instances.map(i=>i.id).join(' → ') + (experiment.entry.closed ? ' → elevator' : ' → out'));
    for (const card of document.querySelectorAll('.component-card')) card.setAttribute('aria-pressed', String(card.dataset.component === experiment.entry.id));
    $('mode-label').textContent = $('mode').selectedOptions[0].text;
    $('error').hidden = true;
    syncLocation(historyMode);
  } catch (error) {fail(error);}
  finally {busy = false; controls();}
}
async function advance() {
  if (busy || finished) return;
  busy = true; controls();
  try {
    if (!session) {
      $('status').textContent = $('mode').value === 'gpu' ? 'Connecting…' : 'Starting…';
      session = await createSession(experiment, $('mode').value, {client});
    }
    show(await session.step());
    scheduleSemanticStep();
    if (finished && $('mode').value !== 'semantic' && !canRepeatGate()) await session.dispose();
  } catch (error) {
    fail(error);
    await session?.dispose().catch(() => {}); session = null;
  } finally {busy = false; controls();}
}
async function checkGPU() {
  if (!localGPU) {
    $('connection').textContent = 'Hosted demo: Semantic and Physical · CPU run in your browser. GPU requires the local CUDA service.';
    $('connect').hidden = true;
    return;
  }
  $('connect').disabled = true;
  $('connection').textContent = 'Connecting to local GPU…';
  try {const info = await client.health(); $('connection').textContent = `Connected · ${info.device}`;}
  catch { $('connection').textContent = 'GPU offline · Start npm run dev, then reconnect.'; }
  finally {$('connect').disabled = false;}
}
$('connect').onclick = checkGPU;
$('reset').onclick = reset;
for (const id of inputs) $(id).onchange = ()=>reset({historyMode:'push'});
let navigationVersion=0;
window.addEventListener('popstate',async()=>{
  const version=++navigationVersion;running=false;
  while(busy)await new Promise(resolve=>setTimeout(resolve,20));
  if(version!==navigationVersion)return;
  readLocation();await reset();
});
$('step').onclick = () => advance();
function scheduleSemanticStep() {
  if ($('mode').value !== 'semantic' || !session) return;
  const {current, nextEventTime} = session.snapshot();
  const virtualDelay = Math.max(0, (nextEventTime ?? current.time) - current.time) * 1000;
  const delay = $('playback').value === 'realtime' ? virtualDelay : $('playback').value === 'fast' ? 0 : 100;
  nextSemanticStepAt = performance.now() + delay;
}
$('playback').onchange = ()=>{scheduleSemanticStep();syncLocation('push');};
$('run').onclick = async () => {
  if (running) {running = false; $('status').textContent = 'Paused'; controls(); return;}
  if (finished) {
    if(canRepeatGate()) {
      busy=true;controls();
      try{show(await session.reenterMarble());finished=false;}
      catch(error){fail(error);}
      finally{busy=false;controls();}
    }
    else await reset();
  }
  if ($('error').hidden) {running = true; lastFrame = 0; scheduleSemanticStep(); controls();}
};
function frame(now) {
  if (running && !busy) {
    if ($('mode').value === 'semantic') {
      if (now >= nextSemanticStepAt) void advance();
    } else if (!lastFrame || now - lastFrame >= 1000 / 60) {
      lastFrame = now;
      void advance();
    }
  }
  requestAnimationFrame(frame);
}
const healthMonitor=setInterval(()=>{if(!$('connect').disabled)void checkGPU();},15000);
window.addEventListener('pagehide', () => {clearInterval(healthMonitor);running = false; void session?.dispose().catch(() => {});});
async function initialize() {
try {
  view = createView($('viewport'));
  await reset(); requestAnimationFrame(frame); void checkGPU();
} catch (error) {fail(error); $('run').disabled = $('step').disabled = true;}

}
void initialize();

function gateReadout(states) {
  if(experiment?.registerBanks&&states)return Object.entries(experiment.registerBanks).map(([name,ids])=>`${name} = ${registerValue(ids,states)} (${ids.map(id=>Number(states[id]==='right')).reverse().join('')})`).join(' · ') + ` · next a return: ${states['a-return']==='left'?2:6}`;
  if(experiment?.registerBits&&states) {
    const bits=experiment.registerBits;
    return `${bits.map(id=>Number(states[id]==='right')).reverse().join('')} = ${registerValue(bits,states)} · live carry state${experiment.returnGate?` · next return: instruction ${states[experiment.returnGate]==='left'?2:6}`:''}`;
  }
  if(states?.['gate-a']!==undefined) {
    const a=Number(states['gate-a']==='right'),b=Number(states['gate-b']==='right');
    return `B A = ${b}${a} · A: ${states['gate-a']} · B: ${states['gate-b']}`;
  }
  return states?.i1!==undefined?`Instruction 1 bit = ${Number(states.i1==='right')} (${states.i1})`:states?.gate??'—';
}

function renderProgram(component,inspecting=false) {
  $('program').hidden=!experiment.program;
  if(!experiment.program)return;
  $('program').querySelector('h2').textContent=`${experiment.program.length}-instruction program`;
  const active=experiment.program.find(instruction=>instruction.id===component);
  $('instruction-pointer').textContent=`${inspecting?'Recorded':'Live'} instruction: ${active?.address??'—'}`;
  $('program-rows').replaceChildren(...experiment.program.map(instruction=>{
    const row=document.createElement('tr');
    row.classList.toggle('active-instruction',instruction.id===component);
    if(instruction.id===component)row.setAttribute('aria-current','step');
    for(const value of [instruction.address,instruction.operation,instruction.mechanism]) {
      const cell=document.createElement('td');cell.textContent=value;row.append(cell);
    }
    return row;
  }));
}
