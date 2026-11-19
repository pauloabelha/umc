// Instruction semantics only. No implicit claim of a marble implementation.
export const sevenInstructionProgram = Object.freeze([
  {op:'INC',register:'a'}, {op:'JUMP',target:5},
  {op:'INC',register:'b'}, {op:'JUMP',target:7},
  {op:'INC',register:'a'}, {op:'JUMP',target:3}, {op:'JUMP',target:1},
].map(Object.freeze));

export class IncJumpMachine {
  #program; #registers; #pc=1; #time=0; #steps=0; #trace=[]; #duration; #speed; #visits;
  constructor({program=sevenInstructionProgram,registers={a:0n,b:0n},duration=1,speed=1}={}) {
    if(!Array.isArray(program)||!program.length)throw new Error('A program is required');
    if(![duration,speed].every(n=>Number.isFinite(n)&&n>0))throw new Error('Duration and speed must be positive');
    this.#registers=new Map(Object.entries(registers));
    for(const [name,value] of this.#registers) {
      if(!/^[a-z][a-z0-9_]*$/i.test(name)||typeof value!=='bigint'||value<0n)throw new Error('Registers require nonnegative BigInt values');
    }
    this.#program=program.map((instruction,index)=>{
      if(instruction.op==='INC') {
        if(!this.#registers.has(instruction.register))throw new Error('Unknown register');
        if(index===program.length-1)throw new Error('INC must have a following instruction');
      } else if(instruction.op==='JUMP') {
        if(!Number.isInteger(instruction.target)||instruction.target<1||instruction.target>program.length)throw new Error('Invalid jump target');
      } else throw new Error('Only INC and JUMP are supported');
      return Object.freeze({...instruction});
    });
    this.#duration=duration;this.#speed=speed;this.#visits=program.map(()=>0);
  }
  snapshot() {
    return {pc:this.#pc,time:this.#time,steps:this.#steps,
      registers:Object.fromEntries([...this.#registers].map(([name,value])=>[name,value.toString()])),
      instructions:this.#program.map((instruction,index)=>({...instruction,address:index+1,
        status:index+1===this.#pc?'active':'ready',executions:this.#visits[index]}))};
  }
  trace(limit=Infinity) {return structuredClone(limit===Infinity?this.#trace:this.#trace.slice(-limit));}
  step() {
    const before=this.snapshot(),instruction=this.#program[this.#pc-1];
    if(instruction.op==='INC') {
      this.#registers.set(instruction.register,this.#registers.get(instruction.register)+1n);
      this.#pc++;
    } else this.#pc=instruction.target;
    this.#visits[before.pc-1]++;
    this.#steps++;
    this.#time=this.#steps*this.#duration/this.#speed;
    const after=this.snapshot();
    this.#trace.push({step:this.#steps,time:this.#time,instruction:before.pc,...instruction,
      next:this.#pc,before:{...before.registers},after:{...after.registers}});
    return after;
  }
}
