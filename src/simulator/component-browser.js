import {physicalCatalog, makeExperiment} from './catalog.js';
import {makeLogicExperiment} from '../logic/circuit.js';
import {logicGates} from '../logic/gates.js';

const primitives = new Set(['straight-track', 'curve-track', 'ramp', 'ferry', 't-gate']);
// Use the model's composition depth, not category names or physical height.
// A standalone primitive's Circuit is only a demonstration wrapper.
export function experimentLevel({circuit}) {
  return circuit.instances.length === 1 ? circuit.instances[0].component.level : circuit.level;
}

export const browserItems = [
  ...physicalCatalog.map(item => ({id:item.id, label:item.label, description:item.description,
    level:experimentLevel(makeExperiment({component:item.id})),
    category:primitives.has(item.id) ? 'Simple parts' : 'Assemblies',
    href:`/simulator/?component=${item.id}&mode=cpu`})),
  ...logicGates.map(item => ({id:item.id, level:experimentLevel(makeLogicExperiment({gate:item.id})), label:item.name, description:`${item.expression} · Closed circuit with fixed inputs`, category:'Gates', href:`/simulator/logic.html?gate=${item.id}&mode=cpu`})),
  {id:'half-adder', level:experimentLevel(makeLogicExperiment({gate:'half-adder'})), label:'Half-adder', description:'XOR + AND · Sum and Carry from one marble', category:'Machines', href:'/simulator/logic.html?gate=half-adder&mode=cpu'},
].sort((a,b)=>b.level-a.level); // Stable: equal-depth components remain peers.
browserItems.find(item=>item.id==='seven-instruction-lattice').category='Machines';

export function mountComponentBrowser() {
  const host=document.getElementById('component-browser');
  host.innerHTML='<div class="browser-heading"><h2>Explore components</h2><span>Most complex on the left · least complex on the right</span></div><p class="browser-level-guide">Composition depth: primitives are Level 0; each assembly is one level above its deepest child. Equal levels are peers. This is not physical height.</p><div class="browser-filters" role="group" aria-label="Component categories"></div><div class="browser-navigation"><button type="button" aria-label="Previous components">←</button><div class="component-row" tabindex="0" role="region" aria-label="Component selection"></div><button type="button" aria-label="Next components">→</button></div>';
  const row=host.querySelector('.component-row');
  for(const item of browserItems) {
    const link=document.createElement('a');
    link.className='browser-card';link.href=item.href;link.dataset.item=item.id;link.dataset.category=item.category;link.dataset.level=String(item.level);
    for(const [tag,text] of [['span',`Level ${item.level} · ${item.category}`],['strong',item.label],['small',item.description]]) {
      const child=document.createElement(tag);child.textContent=text;link.append(child);
    }
    row.append(link);
  }
  const cards=[...row.children];
  for(const category of ['All','Simple parts','Gates','Assemblies','Machines']) {
    const button=document.createElement('button');button.type='button';button.textContent=category;
    button.setAttribute('aria-pressed',String(category==='All'));
    button.onclick=()=>{
      for(const filter of host.querySelectorAll('.browser-filters button'))filter.setAttribute('aria-pressed',String(filter===button));
      for(const card of cards)card.hidden=category!=='All'&&card.dataset.category!==category;
      row.scrollLeft=0;
    };
    host.querySelector('.browser-filters').append(button);
  }
  const arrows=host.querySelectorAll('.browser-navigation > button');
  arrows.forEach((button,index)=>button.onclick=()=>row.scrollBy({left:(index?1:-1)*row.clientWidth*.8,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
  row.addEventListener('keydown',event=>{
    if(event.target!==row||!['ArrowLeft','ArrowRight'].includes(event.key))return;
    event.preventDefault();arrows[event.key==='ArrowRight'?1:0].click();
  });
  new ResizeObserver(()=>{
    const selected=row.querySelector('[aria-current="page"]:not([hidden])');
    if(selected)row.scrollLeft=selected.offsetLeft-4;
  }).observe(row);
  return id=>{
    for(const card of cards) {
      if(card.dataset.item===id){card.setAttribute('aria-current','page');row.scrollLeft=card.offsetLeft-4;}
      else card.removeAttribute('aria-current');
    }
  };
}
