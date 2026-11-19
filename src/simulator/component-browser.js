import {componentCatalog} from './catalog.js';
import {logicGates} from '../logic/gates.js';

const primitives = new Set(['straight-track', 'curve-track', 'ramp', 'ferry', 't-gate']);
export const browserItems = [
  ...componentCatalog.map(item => ({id:item.id, label:item.label, description:item.description,
    category:item.modes ? 'Research' : primitives.has(item.id) ? 'Simple parts' : 'Assemblies',
    href:`/simulator/?component=${item.id}&mode=semantic`})),
  ...logicGates.map(item => ({id:item.id, label:item.name, description:`${item.expression} · Closed circuit with fixed inputs`, category:'Gates', href:`/simulator/logic.html?gate=${item.id}&mode=semantic`})),
  {id:'half-adder', label:'Half-adder', description:'XOR + AND · Sum and Carry from one marble', category:'Machines', href:'/simulator/logic.html?gate=half-adder&mode=semantic'},
  {id:'instruction-reference', label:'Instruction machine views', description:'Seven instructions · reference, T-gate wiring and primitive circuit', category:'Machines', href:'/simulator/machine.html'},
];
browserItems.find(item=>item.id==='seven-instruction-lattice').category='Machines';

export function mountComponentBrowser() {
  const host=document.getElementById('component-browser');
  host.innerHTML='<div class="browser-heading"><h2>Explore components</h2><span>Swipe the row or use the arrows</span></div><div class="browser-filters" role="group" aria-label="Component categories"></div><div class="browser-navigation"><button type="button" aria-label="Previous components">←</button><div class="component-row" tabindex="0" role="region" aria-label="Component selection"></div><button type="button" aria-label="Next components">→</button></div>';
  const row=host.querySelector('.component-row');
  for(const item of browserItems) {
    const link=document.createElement('a');
    link.className='browser-card';link.href=item.href;link.dataset.item=item.id;link.dataset.category=item.category;
    for(const [tag,text] of [['span',item.category],['strong',item.label],['small',item.description]]) {
      const child=document.createElement(tag);child.textContent=text;link.append(child);
    }
    row.append(link);
  }
  const cards=[...row.children];
  for(const category of ['All','Simple parts','Gates','Assemblies','Machines','Research']) {
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
