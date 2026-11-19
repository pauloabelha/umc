// Fixed output rail labels, in input order 00, 01, 10, 11.
// The moving marble selects a rail; the UI never evaluates a Boolean expression.
export const logicGates=Object.freeze([
  {id:'buffer',name:'Buffer',inputs:1,rails:[0,0,1,1],expression:'Y = A'},
  {id:'not',name:'NOT',inputs:1,rails:[1,1,0,0],expression:'Y = ¬A'},
  {id:'and',name:'AND',inputs:2,rails:[0,0,0,1],expression:'Y = A ∧ B'},
  {id:'or',name:'OR',inputs:2,rails:[0,1,1,1],expression:'Y = A ∨ B'},
  {id:'nand',name:'NAND',inputs:2,rails:[1,1,1,0],expression:'Y = ¬(A ∧ B)'},
  {id:'nor',name:'NOR',inputs:2,rails:[1,0,0,0],expression:'Y = ¬(A ∨ B)'},
  {id:'xor',name:'XOR',inputs:2,rails:[0,1,1,0],expression:'Y = A ⊕ B'},
  {id:'xnor',name:'XNOR',inputs:2,rails:[1,0,0,1],expression:'Y = ¬(A ⊕ B)'},
].map(gate=>Object.freeze({...gate,rails:Object.freeze(gate.rails)})));
export function inputBit(value) {
  if(value!==0&&value!==1)throw new Error('Inputs must be 0 or 1');
  return value;
}
