export function instructionTriad(program, currentId, previousId, halted=false) {
  const current=program?.find(item=>item.id===currentId);
  return {
    previous:program?.find(item=>item.id===previousId),
    current,
    next:!halted&&current?program.find(item=>item.address===(current.op==='JUMP'?current.target:current.address+1)):undefined,
  };
}

export function createInstructionTriad(host) {
  const panel=document.createElement('div');panel.className='instruction-triad';panel.hidden=true;
  panel.setAttribute('aria-label','Instruction sequence');
  for(const name of ['previous','current','next']) {
    const cell=document.createElement('div');cell.className=`triad-${name}`;
    const label=document.createElement('span');label.textContent=name;
    const value=document.createElement('strong');value.textContent='—';cell.append(label,value);panel.append(cell);
  }
  host.append(panel);
  return (program,currentId,previousId,halted=false,recorded=false)=>{
    panel.hidden=!program;
    if(!program)return;
    const triad=instructionTriad(program,currentId,previousId,halted);
    panel.title=recorded?'Recorded instruction sequence':'Observed previous/current instruction; next is the programmed successor if execution completes without overflow';
    for(const [name,item] of Object.entries(triad)) {
      const value=panel.querySelector(`.triad-${name} strong`),text=item?`${item.address} · ${item.operation}`:'—';
      if(value.textContent!==text)value.textContent=text;
    }
  };
}
