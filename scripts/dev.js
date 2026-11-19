import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
const root=fileURLToPath(new URL('../',import.meta.url));
const children=new Set();
let stopping=false,gpu=null,monitor=null,checking=false,unhealthy=0;
function stop(code=0) {
  if(stopping)return;
  stopping=true;clearInterval(monitor);
  for(const child of children)child.kill('SIGTERM');
  process.exitCode=code;
}
function start(command,args,{service=false}={}) {
  const child=spawn(command,args,{cwd:root,stdio:'inherit'});children.add(child);
  child.on('error',error=>{
    console.error(error.message);children.delete(child);
    if(child===gpu)gpu=null;
    if(!service)stop(1);
  });
  child.on('exit',code=>{
    children.delete(child);
    if(child===gpu)gpu=null;
    if(stopping)return;
    if(service)console.error(`GPU service exited (${code}); supervisor will restart it.`);
    else stop(code??1);
  });
  return child;
}
async function health() {
  try {const response=await fetch('http://127.0.0.1:8792/health',{signal:AbortSignal.timeout(2000)});return response.ok?await response.json():null;}
  catch{return null;}
}
const valid=info=>info?.format==='umc-gpu'&&info.cuda;
function startGPU() {gpu=start(`${root}.venv-gpu/bin/python`,['-u','gpu/server.py'],{service:true});}
async function supervise() {
  if(stopping||checking)return;
  checking=true;
  try {
    const info=await health();
    if(stopping)return;
    if(valid(info)){unhealthy=0;return;}
    if(info){console.error('Port 8792 is not serving a CUDA-enabled UMC service.');return;}
    if(!gpu){console.log('Starting UMC GPU service…');startGPU();unhealthy=0;}
    else if(++unhealthy>=3){console.error('GPU service health checks failed; restarting it.');gpu.kill('SIGTERM');unhealthy=0;}
  } finally {checking=false;}
}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
try {
  let info=await health();
  if(!info) {
    startGPU();const until=Date.now()+30000;
    while(!stopping&&!info&&Date.now()<until){await delay(250);info=await health();}
  }
  if(!stopping) {
    if(!valid(info))throw new Error('CUDA unavailable. Check GPU setup in README.');
    console.log(`CUDA: ${info.device}\nSimulator: http://127.0.0.1:5173/simulator/`);
    start(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort']);
    monitor=setInterval(()=>void supervise(),3000);
  }
} catch(error){console.error(error.message);stop(1);}
