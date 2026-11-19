// Contact-driven seesaw proposed by the user. Dimensions remain provisional.
export function tGateMechanism(id, {unit=.06,initialState='left'}={}) {
  const s=unit/.06, pos=p=>p.map(v=>v*s), bodies=[];
  const box=(name,position,size,color='#9b59c7',rotation=[0,0,0,1])=>bodies.push({id:`${id}/${name}`,motion:'fixed',position:pos(position),rotation,shape:{kind:'box',size:pos(size)},color,friction:.2,restitution:0});
  // Upper approach, ending above the rocker. Front/back cheeks retain the
  // marble in the rocking plane without prescribing which exit it takes.
  const pitch=Math.atan2(-.005,.065);
  box('in-floor',[.09,.0555,.0325],[.068,.004,Math.hypot(.065,.005)],'#9b59c7',[Math.sin(-pitch/2),0,0,Math.cos(pitch/2)]);
  for(const side of [-1,1]) {
    const yaw=-side*Math.atan2(.015,.065);
    box(`in-wall-${side}`,[.09+side*.0265,.073,.0325],[.004,.035,Math.hypot(.065,.015)],'#9b59c7',[0,Math.sin(yaw/2),0,Math.cos(yaw/2)]);
  }
  box('front-cheek',[.09,.024,.065],[.18,.048,.004]);
  box('back-cheek',[.09,.045,.115],[.18,.09,.004]);
  for(const side of [-1,1]) {
    const slope=side*Math.atan2(-.003,.042);
    box(`out-floor-${side}`,[.09+side*.069,-.0005,.09],[Math.hypot(.042,.003),.004,.046],'#9b59c7',[0,0,Math.sin(slope/2),Math.cos(slope/2)]);
  }
  bodies.push({id:`${id}/rocker`,motion:'dynamic',position:pos([.09,.025,.09]),rotation:[0,0,0,1],mass:.001*s**3,
    stateVisual:{axis:[0,0,1],angles:{left:-.4,right:.4},initialState},
    hinge:{axis:[0,0,1],limits:[-.4,.4],angle:initialState==='left'?-.4:.4},
    shape:{kind:'compound',children:[
      {position:[0,0,0],rotation:[0,0,0,1],shape:{kind:'box',size:pos([.09,.004,.044])},massFraction:.2},
      {position:pos([0,.0125,0]),rotation:[0,0,0,1],shape:{kind:'box',size:pos([.004,.025,.044])},massFraction:.8},
    ]},color:'#ffcb32',friction:.2,restitution:0});
  return {bodies};
}
