import {tGate} from '../components/t-gate.js';
import {passSemantically} from '../backends/semantic.js';
import {sevenInstructionProgram} from './inc-jump.js';

// Logical wiring, not a spatial Circuit: transport, merges and lifts still need
// lattice implementations. A single marble carries no address or register data.
export class GateMachine {
  #nodes=new Map(); #states=new Map(); #location='i1'; #active=1;
  #time=0; #steps=0; #events=[]; #trace=[]; #visits=Array(7).fill(0);
  #before=null; #halt=null; #bits; #speed;
  constructor({bits=4,speed=1}={}) {
    if(!Number.isInteger(bits)||bits<1||bits>64)throw new Error('Register width must be 1–64 bits');
    if(!Number.isFinite(speed)||speed<=0)throw new Error('Invalid execution speed');
    this.#bits=bits;this.#speed=speed;
    for(const [index,instruction] of sevenInstructionProgram.entries()) {
      this.#nodes.set(`i${index+1}`,{kind:'instruction',instruction,
        routes:{out:instruction.op==='INC'?`${instruction.register}-bit-0`:`i${instruction.target}`}});
    }
    for(const register of ['a','b'])for(let bit=0;bit<bits;bit++) {
      this.#gate(`${register}-bit-${bit}`,{left:register==='a'?'a-return':'i4',
        right:bit+1<bits?`${register}-bit-${bit+1}`:`${register}-overflow`});
    }
    // Calls to a alternate i1/i5 in this specific program. This is explicit
    // retained phase, not a general caller-sensitive return or a writable PC.
    this.#gate('a-return',{left:'i2',right:'i6'});
  }
  #gate(id,routes) {
    this.#nodes.set(id,{kind:'gate',instance:tGate().instantiate(id),routes});
    this.#states.set(id,'left');
  }
  #registers() {
    return Object.fromEntries(['a','b'].map(register=>{
      let value=0n;
      for(let bit=0;bit<this.#bits;bit++)if(this.#states.get(`${register}-bit-${bit}`)==='right')value|=1n<<BigInt(bit);
      return [register,value.toString()];
    }));
  }
  snapshot() {
    return {pc:this.#active,time:this.#time,steps:this.#steps,registers:this.#registers(),
      bits:this.#bits,location:this.#location,halt:this.#halt,
      gates:Object.fromEntries(this.#states),
      instructions:sevenInstructionProgram.map((instruction,index)=>({...instruction,address:index+1,
        status:index+1===this.#active?(this.#halt?'overflow':this.#location===`i${this.#active}`?'active':'executing'):'ready',
        executions:this.#visits[index]}))};
  }
  topology() {
    return [...this.#nodes].map(([id,node])=>({id,kind:node.kind,routes:{...node.routes}}));
  }
  trace(limit=Infinity) {return structuredClone(limit===Infinity?this.#trace:this.#trace.slice(-limit));}
  componentTrace(limit=Infinity) {return structuredClone(limit===Infinity?this.#events:this.#events.slice(-limit));}
  stepComponent() {
    if(this.#halt)return this.snapshot();
    if(this.#before===null)this.#before=this.#registers();
    const id=this.#location,node=this.#nodes.get(id);
    let output='out',transition=null;
    if(node.kind==='gate') {
      const before=this.#states.get(id);
      const passage=passSemantically(node.instance,{id:'marble'},'in',{state:before,speed:this.#speed});
      output=passage.output;this.#states.set(id,passage.state);
      transition={before,after:passage.state};
    }
    const next=node.routes[output];
    this.#time=(this.#events.length+1)/this.#speed;
    this.#events.push({time:this.#time,marble:'marble',from:id,output,to:next,transition});
    this.#location=next;
    if(next.endsWith('-overflow')) {
      this.#halt=`Register ${next[0]} overflow: add capacity and reset. INC did not complete.`;
    } else if(this.#nodes.get(next).kind==='instruction') {
      const instruction=sevenInstructionProgram[this.#active-1];
      this.#steps++;this.#visits[this.#active-1]++;
      this.#trace.push({step:this.#steps,time:this.#time,instruction:this.#active,...instruction,
        next:Number(next.slice(1)),before:this.#before,after:this.#registers()});
      this.#before=null;this.#active=Number(next.slice(1));
    }
    return this.snapshot();
  }
  step() {
    const completed=this.#steps;
    // A register can traverse at most bits gates plus entry and return gate.
    for(let i=0;i<this.#bits+2&&!this.#halt&&this.#steps===completed;i++)this.stepComponent();
    return this.snapshot();
  }
}
