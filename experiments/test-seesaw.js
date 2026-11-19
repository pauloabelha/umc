import {Component} from '../src/component.js';
import {Circuit} from '../src/circuit.js';
import {tGate} from '../src/components/t-gate.js';
import {tGateMechanism} from '../src/components/t-gate-mechanism.js';
import {physicalWorld} from '../src/backends/physical.js';
export function seesawCircuit(initialState='left',scale=1) {
 const gate=tGate();const c=new Component({name:'TGate',ports:gate.ports,initialState,expectedDuration:1,evidence:gate.evidence,semantic:gate.semantic,physical:id=>tGateMechanism(id,{initialState})});return new Circuit([c.instantiate('gate')],{scale});
}
for(const initialState of ['left','right'])for(const offset of [-.006,0,.006]) {
 const world=await physicalWorld(seesawCircuit(initialState),{timestep:1/960});
 world.addMarble({id:'marble',position:[.09+offset,.073,.005]});let s;
 for(let i=0;i<960*8;i++){world.step();s=world.snapshot('marble');if(s.position[0]<0||s.position[0]>.18||s.position[1]<-.05)break;}
 console.log(JSON.stringify({initialState,offset,...s,mechanisms:world.mechanismSnapshot()}));world.dispose();
}
