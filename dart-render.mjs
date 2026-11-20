// Dessin vectoriel d'une fléchette de compétition : pointe en acier, fût tungstène
// rainuré, bagues de prise, tige, ailettes à facettes. Pas d'image externe.
export const DART_STYLES = Object.freeze({
  franck:   {flight:'#d94939',deep:'#6d1925',trim:'#fff0d2',metal:'#b9c6ca',stripe:'#e5b25e'},
  stephane: {flight:'#dbad5c',deep:'#3d3020',trim:'#fff6d9',metal:'#c2b7a2',stripe:'#efdab2'},
  mathias:  {flight:'#72a6a0',deep:'#243e42',trim:'#f8efe1',metal:'#8797a0',stripe:'#b9d2a9'},
  invite:   {flight:'#7284a9',deep:'#283758',trim:'#fff4dd',metal:'#aeb9c5',stripe:'#9cb3ea'}
});

export function drawCompetitionDart(ctx,x,y,angle,scale=1,alpha=1,style='stephane'){
  const c=DART_STYLES[style]||DART_STYLES.invite;
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(scale,scale);ctx.globalAlpha*=alpha;
  ctx.lineJoin='round';ctx.lineCap='round';
  // Le point d'impact de la pointe est exactement (0,0).
  ctx.shadowColor='#0a0d0ccd';ctx.shadowBlur=5;ctx.shadowOffsetY=3;
  const point=ctx.createLinearGradient(0,-3,0,3);
  point.addColorStop(0,'#798c94');point.addColorStop(.28,'#f3fbff');point.addColorStop(.65,'#9babb4');point.addColorStop(1,'#3c4a52');
  ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-4,-1.1);ctx.lineTo(-34,-2.8);ctx.lineTo(-35,2.8);ctx.lineTo(-4,1.1);ctx.closePath();ctx.fillStyle=point;ctx.fill();
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  ctx.strokeStyle='#effaff9c';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(-5,-.5);ctx.lineTo(-32,-1.6);ctx.stroke();
  // Fût en tungstène facetté, légèrement fuselé aux extrémités.
  const barrel=ctx.createLinearGradient(0,-7.5,0,7.5);
  barrel.addColorStop(0,'#263035');barrel.addColorStop(.10,'#63737c');barrel.addColorStop(.26,'#ebf0eb');
  barrel.addColorStop(.42,c.metal);barrel.addColorStop(.63,'#aebbbf');barrel.addColorStop(.82,'#4f5d63');barrel.addColorStop(1,'#151d21');
  ctx.beginPath();ctx.moveTo(-35,-3.1);ctx.lineTo(-42,-6.8);ctx.lineTo(-91,-7.2);ctx.lineTo(-99,-4.2);ctx.lineTo(-99,4.2);ctx.lineTo(-91,7.2);ctx.lineTo(-42,6.8);ctx.lineTo(-35,3.1);ctx.closePath();ctx.fillStyle=barrel;ctx.fill();
  ctx.save();ctx.clip();
  // Rainurage croisé : la texture du grip est une vraie partie du design.
  for(let i=-91;i<=-44;i+=3.35){
    ctx.strokeStyle=i%2<1?'#1e2b30b8':'#fff8e477';ctx.lineWidth=1.05;
    ctx.beginPath();ctx.moveTo(i-5,-8);ctx.lineTo(i+5,8);ctx.stroke();
    ctx.beginPath();ctx.moveTo(i+5,-8);ctx.lineTo(i-5,8);ctx.stroke();
  }
  // Zones polies et bagues de contrôle séparant les prises.
  for(const a of [-91,-86,-66,-61,-43]){
    ctx.fillStyle='#182a2d';ctx.fillRect(a,-8,1.7,16);
    ctx.fillStyle='#f4e4b1af';ctx.fillRect(a+1.7,-8,.72,16);
  }
  ctx.fillStyle=c.stripe;ctx.fillRect(-61,-6.9,2.3,13.8);
  ctx.fillStyle='#ffffffaa';ctx.fillRect(-96,-2.5,48,.85);
  ctx.restore();
  ctx.strokeStyle='#29363c';ctx.lineWidth=.8;ctx.stroke();
  // Joint de vissage fût/tige.
  ctx.fillStyle='#1b292f';ctx.fillRect(-102,-3.6,4.5,7.2);
  ctx.fillStyle='#f4dec0';ctx.fillRect(-101,-2.2,.9,4.4);
  // Tige moderne légère.
  const stem=ctx.createLinearGradient(0,-3.2,0,3.2);
  stem.addColorStop(0,'#0e151c');stem.addColorStop(.22,'#d6dce0');stem.addColorStop(.48,c.deep);stem.addColorStop(.8,'#47545b');stem.addColorStop(1,'#0a0e14');
  ctx.beginPath();ctx.moveTo(-100,-2.8);ctx.lineTo(-135,-2.2);ctx.lineTo(-135,2.2);ctx.lineTo(-100,2.8);ctx.closePath();ctx.fillStyle=stem;ctx.fill();
  ctx.strokeStyle='#dfe6eb';ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(-102,-1.5);ctx.lineTo(-133,-1.5);ctx.stroke();
  for(let b of [-105,-111,-129,-133]){ctx.fillStyle='#dfd7c08c';ctx.fillRect(b,-2.8,1.05,5.6);}
  // Ailettes polygonales semi-mates, plis et renforts : plusieurs facettes.
  ctx.shadowColor='#000a';ctx.shadowBlur=5;ctx.shadowOffsetY=2;
  ctx.beginPath();ctx.moveTo(-132,0);ctx.lineTo(-153,-17);ctx.quadraticCurveTo(-158,-20,-165,-18);
  ctx.lineTo(-162,-2);ctx.lineTo(-171,0);ctx.lineTo(-162,2);ctx.lineTo(-165,18);
  ctx.quadraticCurveTo(-158,20,-153,17);ctx.closePath();ctx.fillStyle=c.deep;ctx.fill();
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  ctx.beginPath();ctx.moveTo(-132,0);ctx.lineTo(-153,-17);ctx.lineTo(-165,-18);ctx.lineTo(-162,-2);ctx.lineTo(-171,0);ctx.closePath();ctx.fillStyle=c.flight;ctx.fill();
  ctx.beginPath();ctx.moveTo(-132,0);ctx.lineTo(-153,17);ctx.lineTo(-165,18);ctx.lineTo(-162,2);ctx.lineTo(-171,0);ctx.closePath();ctx.fillStyle=c.deep;ctx.fill();
  ctx.strokeStyle=c.trim;ctx.lineWidth=1.1;
  ctx.beginPath();ctx.moveTo(-133,0);ctx.lineTo(-160,-10);ctx.lineTo(-164,-18);ctx.moveTo(-133,0);ctx.lineTo(-160,10);ctx.lineTo(-164,18);ctx.stroke();
  ctx.strokeStyle='#ffffffa1';ctx.lineWidth=.65;
  ctx.beginPath();ctx.moveTo(-137,0);ctx.lineTo(-166,0);ctx.stroke();
  ctx.fillStyle=c.trim;ctx.beginPath();ctx.moveTo(-149,-3);ctx.lineTo(-156,-7);ctx.lineTo(-154,0);ctx.closePath();ctx.fill();
  ctx.restore();
}

export function dartAppearanceFor(players=[],uid,defaultStyle='stephane'){
  return (players.find(p=>p.uid===uid)?.avatar)||defaultStyle;
}
