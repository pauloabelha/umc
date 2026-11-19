export function renderComposition(container, composition, onSelect) {
  container.replaceChildren();
  function render(node) {
    const item=document.createElement('li');
    if(node.children) {
      const details=document.createElement('details'),summary=document.createElement('summary');
      summary.textContent=`${node.name} · Level ${node.level} · ${node.children.length} subcomponents`;
      details.open=node===composition;details.append(summary);
      const children=document.createElement('ul');
      for(const child of node.children)children.append(render(child));
      details.append(children);item.append(details);
    } else {
      const button=document.createElement('button');button.type='button';button.className='link-button';
      button.textContent=`${node.id} · ${node.name} · Level ${node.level}`;
      button.onclick=()=>onSelect(node.id);item.append(button);
    }
    return item;
  }
  const tree=document.createElement('ul');tree.append(render(composition));container.append(tree);
}
