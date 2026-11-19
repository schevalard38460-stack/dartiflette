import {SECTORS,clamp,makeRoom,applyThrow,targetFromGesture} from './rules.mjs';
import {createOnlineRoom,joinOnlineRoom,listenRoom,connectFirebase,setSettings,startOnline,throwOnline,teaseOnline} from './firebase-net.mjs';
const $=id=>document.getElementById(id);
const canvas=$('board'),ctx=canvas.getContext('2d');
const sectors=SECTORS;
const colors={red:'#b34738',green:'#36704f',black:'#202522',cream:'#ead5ab'};
let layout={x:0,y:0,r:200,w:600,h:600},darts=[],flight=null,down=null,marker=null,launchX=0;
const boardBuffer=document.createElement('canvas');let boardDirty=true,lastFrame=0;
let session='menu',room=null,roomCode='',uid='',avatar='stephane',stopListener=null,busy=false;
let lastShotSeq=0,lastReactionSeq=0,solo=null,lastToast=null;
const savedName=()=>{try{return localStorage.getItem('df-name')}catch{return null}};
$('nickname').value=savedName()||'Stéphane';
const invite=new URL(location.href).searchParams.get('room');
if(invite && /^[A-HJ-NP-Z2-9]{7}$/.test(invite.toUpperCase()))$('room-input').value=invite.toUpperCase();
function safe(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function playerName(){const n=$('nickname').value.trim().slice(0,18)||'Joueur';try{localStorage.setItem('df-name',n)}catch{}return n;}
function note(s){$('online-note').textContent=s;}
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('visible');clearTimeout(lastToast);lastToast=setTimeout(()=>$('toast').classList.remove('visible'),3100);}
function badge(msg){$('shot-badge').textContent=msg;$('shot-badge').classList.add('visible');setTimeout(()=>$('shot-badge').classList.remove('visible'),1000);}
function show(page){for(const id of ['setup','lobby','match'])$(id).classList.toggle('hidden',id!==page);}
function enableButtons(yes){for(const id of ['create','join'])$(id).disabled=!yes;}
function setAvatar(a){avatar=a;document.querySelectorAll('.avatar-choice').forEach(el=>{const active=el.dataset.avatar===a;el.classList.toggle('selected',active);el.setAttribute('aria-pressed',String(active));});$('nickname').value={stephane:'Stéphane',franck:'Franck',mathias:'Mathias'}[a];}
for(const el of document.querySelectorAll('.avatar-choice'))el.addEventListener('click',()=>setAvatar(el.dataset.avatar));
function sensitive(id,output){$(id).addEventListener('input',()=>$(output).textContent=Number($(id).value).toFixed(2)+'×');}
for(const a of [['solo-force','solo-force-value'],['solo-direction','solo-direction-value'],['force-sensitivity','force-value'],['direction-sensitivity','direction-value']])sensitive(...a);
function playerLine(p,i,active=false){
  const face=['franck','stephane','mathias'].includes(p.avatar)?p.avatar:'stephane';
  return `<div class="player ${active?'active':''}"><img class="avatar-portrait" src="assets/${face}.webp" alt=""><div class="player-details"><strong>${safe(p.name)}</strong><small>${active?'À LA CIBLE':`JOUEUR ${i+1}`}</small></div>${Number.isFinite(p.score)?`<span class="points">${p.score}</span>`:''}</div>`;
}
function renderState(){
  const current=session==='solo'?solo:room;if(!current)return;
  const playing=current.status==='playing',finished=current.status==='finished';
  if(session==='online'&&current.status==='lobby'){
    show('lobby');$('room-code').textContent=roomCode;
    $('lobby-players').innerHTML=current.players.map((p,i)=>playerLine({...p,score:undefined},i)).join('');
    const host=current.host===uid;$('host-controls').classList.toggle('hidden',!host);
    if(document.activeElement!==$('force-sensitivity'))$('force-sensitivity').value=current.force;
    if(document.activeElement!==$('direction-sensitivity'))$('direction-sensitivity').value=current.direction;
    $('force-value').textContent=Number(current.force).toFixed(2)+'×';$('direction-value').textContent=Number(current.direction).toFixed(2)+'×';
    $('lobby-note').textContent=`${current.players.length}/3 joueurs · Sensibilité force ${current.force.toFixed(2)}× / direction ${current.direction.toFixed(2)}×. ${current.players.length<3?'En attente des autres…':'Prêts !'}`;
    $('start').classList.toggle('hidden',!host||current.players.length!==3);
    return;
  }
  show('match');
  $('match-title').textContent=current.mode;
  $('room-pill').textContent=session==='solo'?'ENTRAÎNEMENT':`SALLE ${roomCode}`;
  $('double-pill').textContent=current.doubleOut?'DOUBLE OUT':'FIN LIBRE';
  const f=session==='solo'?Number($('solo-force').value):current.force;
  const d=session==='solo'?Number($('solo-direction').value):current.direction;
  $('sensitivity-pill').textContent=`F ${f.toFixed(2)}× · D ${d.toFixed(2)}×`;
  $('players').innerHTML=current.players.map((p,i)=>playerLine(p,i,i===current.turn&&playing)).join('');
  const active=current.players[current.turn];
  $('turn-name').textContent=finished?'Partie terminée':`${active.name}${active.uid===uid?' (toi)':''}`;
  $('dart-counter').textContent=finished?'':`Fléchette ${(active.darts||0)+1}/3`;
  const last=current.lastHit;if(last){$('last-shot').textContent=`${current.players.find(p=>p.uid===last.uid)?.name||''} : ${last.label}${last.bust?' — BUST':''}`;$('quip').textContent=last.quip||'';}
  const winner=current.players.find(p=>p.uid===current.winner);
  $('win-banner').textContent=winner?`🏆 ${winner.name} A GAGNÉ !`:'';
  $('win-banner').classList.toggle('hidden',!finished);
  $('restart').classList.toggle('hidden',session==='online'?(current.host!==uid||!finished):!finished);
  $('banter').classList.toggle('hidden',session!=='online');
  $('tease-target').innerHTML=current.players.filter(p=>p.uid!==uid).map(p=>`<option value="${safe(p.uid)}">${safe(p.name)}</option>`).join('');
}
function handleState(next){
  if(!next){toast('Cette salle n’existe plus');leave();return;}
  const previousStatus=room?.status,previousLast=room?.lastHit?.seq||0;
  const previousReact=room?.lastReaction?.seq||0;
  room=next;session='online';
  if(next.lastHit&&next.lastHit.seq!==previousLast){
    const h=next.lastHit;animateHit(h.x,h.y,h.label,h.bust,h.won);
  }
  if(next.lastReaction&&next.lastReaction.seq!==previousReact&&previousReact!==0){
    const target=next.players.find(p=>p.uid===next.lastReaction.target)?.name||'Un joueur';
    toast(`${target} : Tocar !`);
  }
  if(next.status==='playing'&&previousStatus==='lobby')toast('La partie commence !');
  renderState();
}
function leave(){if(stopListener){stopListener();stopListener=null;}room=null;roomCode='';solo=null;busy=false;down=null;darts=[];flight=null;launchX=0;session='menu';show('setup');}
async function attempt(task){enableButtons(false);note('Connexion sécurisée à Firebase…');try{await task();note('Prêt !');}catch(e){toast(e.message);note(e.message);}finally{enableButtons(true);}}
$('create').addEventListener('click',()=>attempt(async()=>{
  const data=await createOnlineRoom(playerName(),avatar,Number($('game-mode').value),$('checkout').value==='true');
  uid=data.uid;roomCode=data.code;session='online';lastShotSeq=0;lastReactionSeq=0;
  stopListener=listenRoom(roomCode,handleState,e=>toast(e.message));
}));
$('join').addEventListener('click',()=>attempt(async()=>{
  const code=$('room-input').value.trim().toUpperCase();if(!/^[A-HJ-NP-Z2-9]{7}$/.test(code))throw Error('Entre le code à 7 caractères envoyé par ton ami');
  const data=await joinOnlineRoom(code,playerName(),avatar);
  uid=data.uid;roomCode=code;session='online';lastShotSeq=0;lastReactionSeq=0;
  stopListener=listenRoom(roomCode,handleState,e=>toast(e.message));
}));
$('practice').addEventListener('click',()=>{
  leave();uid='solo';solo={...makeRoom(uid,playerName(),avatar,Number($('game-mode').value),$('checkout').value==='true'),status:'playing'};
  session='solo';$('last-shot').textContent='À toi de jouer !';$('quip').textContent='';renderState();toast('Place la fléchette en bas puis lance vers le haut !');
});
$('save-sensitivity').addEventListener('click',async()=>{
  try{await setSettings(roomCode,Number($('force-sensitivity').value),Number($('direction-sensitivity').value));toast('Réglage appliqué aux 3 joueurs');}catch(e){toast(e.message);}
});
$('start').addEventListener('click',async()=>{try{await startOnline(roomCode);}catch(e){toast(e.message);}});
$('share').addEventListener('click',async()=>{
  const url=new URL(location.href);url.searchParams.set('room',roomCode);
  try{await navigator.clipboard.writeText(url.href);toast('Lien copié : envoie-le à tes amis');}
  catch{toast(`Code de salle : ${roomCode}`);}
});
$('tease').addEventListener('click',async()=>{try{await teaseOnline(roomCode,$('tease-target').value);toast('Chambrage envoyé !');}catch(e){toast(e.message);}});
$('restart').addEventListener('click',async()=>{
  if(session==='solo'){$('practice').click();return;}
  try{await startOnline(roomCode);}catch(e){toast(e.message);}
});
$('exit').addEventListener('click',leave);$('leave-lobby').addEventListener('click',leave);
function allowedTurn(){
  if(session==='solo')return solo?.status==='playing';
  return session==='online'&&room?.status==='playing'&&room.players[room.turn]?.uid===uid;
}
function localShot(x,y){solo=applyThrow(solo,uid,x,y);const h=solo.lastHit;animateHit(x,y,h.label,h.bust,h.won);renderState();}
function animateHit(x,y,label,bust,won){flight={sx:x+.2,sy:y-.4,x,y,t:performance.now(),color:bust?'#e46559':won?'#f9e69b':'#f8e8d0'};badge(won?'VICTOIRE !':bust?'BUST !':label);}
function coordinates(e){const rect=canvas.getBoundingClientRect();return{x:e.clientX-rect.left,y:e.clientY-rect.top};}
function launchZoneY(){return layout.h*.69;}
function placement(p){return clamp((p.x-layout.x)/layout.r*1.7,-1.55,1.55);}
canvas.addEventListener('pointerdown',e=>{
  if(!allowedTurn()){toast(session==='online'?'Attends ton tour !':'Démarre une partie');return;}
  if(busy)return;
  const p=coordinates(e);if(p.y<launchZoneY()){toast('Utilise la zone du bas pour lancer');return;}
  down={p,current:p,time:performance.now(),id:e.pointerId,initialX:launchX};canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{if(!down||down.id!==e.pointerId)return;down.current=coordinates(e);const dx=down.current.x-down.p.x,dy=down.current.y-down.p.y;
  launchX=(Math.abs(dx)>Math.abs(dy)*1.3||Math.abs(dy)<18)?placement(down.current):down.initialX;
});
canvas.addEventListener('pointerup',async e=>{
  if(!down||down.id!==e.pointerId)return;
  const p=coordinates(e),dx=p.x-down.p.x,dy=p.y-down.p.y,elapsed=performance.now()-down.time;
  if(dy>=-32||Math.abs(dx)>Math.abs(dy)*1.4){launchX=placement(p);down=null;if(Math.abs(dx)>8)toast('Fléchette positionnée');return;}
  launchX=down.initialX;down=null;
  const current=session==='solo'?solo:room;
  const target=targetFromGesture(dx,dy,elapsed,launchX,layout.h,session==='solo'?Number($('solo-force').value):current.force,session==='solo'?Number($('solo-direction').value):current.direction);
  busy=true;
  try{if(session==='solo')localShot(target.x,target.y);else await throwOnline(roomCode,target.x,target.y);}
  catch(e){toast(e.message);}finally{busy=false;}
});
canvas.addEventListener('pointercancel',()=>{if(down)launchX=down.initialX;down=null;});

function resize() {
  const rect=canvas.getBoundingClientRect();
  const dpr=Math.min(2,window.devicePixelRatio||1);
  canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  layout={w:rect.width,h:rect.height,x:rect.width*.49,y:rect.height*.49,r:Math.min(rect.width*.41,rect.height*.35)};boardDirty=true;
}
new ResizeObserver(resize).observe(canvas);
const R=r=>r/1.7*layout.r;
function polar(angle,r) {return [layout.x+Math.sin(angle)*R(r),layout.y-Math.cos(angle)*R(r)];}
function ringSlice(inner,outer,mid,fill) {
  const steps=9;const half=Math.PI/20,angle=mid*Math.PI/10;
  ctx.beginPath();
  let p=polar(angle-half,outer);ctx.moveTo(...p);
  for(let j=1;j<=steps;j++){p=polar(angle-half+(j/steps)*(2*half),outer);ctx.lineTo(...p)}
  for(let j=steps;j>=0;j--){p=polar(angle-half+(j/steps)*(2*half),inner);ctx.lineTo(...p)}
  ctx.closePath();ctx.fillStyle=fill;ctx.fill();
}
function ringStroke(radius,color,width) {ctx.beginPath();ctx.arc(layout.x,layout.y,R(radius),0,2*Math.PI);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke()}
function boardDraw() {
  const {x,y,r}=layout;if(!r)return;
  // Weathered wooden backboard and dramatic 3D shadow.
  ctx.save();ctx.shadowColor='#070b09cc';ctx.shadowBlur=35;ctx.shadowOffsetY=15;
  ctx.beginPath();ctx.arc(x,y,r*1.21,0,2*Math.PI);ctx.fillStyle='#141711';ctx.fill();ctx.restore();
  const frame=ctx.createRadialGradient(x-r*.35,y-r*.45,r*.1,x,y,r*1.22);
  frame.addColorStop(0,'#5d452f');frame.addColorStop(.73,'#2d251b');frame.addColorStop(.94,'#0f100e');frame.addColorStop(1,'#92714c');
  ctx.beginPath();ctx.arc(x,y,r*1.19,0,Math.PI*2);ctx.fillStyle=frame;ctx.fill();
  ctx.beginPath();ctx.arc(x,y,r*1.01,0,Math.PI*2);ctx.fillStyle='#111a15';ctx.fill();
  for(let i=0;i<20;i++){
    const c=i%2===0;
    ringSlice(.159,.99,i,c?colors.black:colors.cream);
    ringSlice(.99,1.07,i,c?colors.red:colors.green);
    ringSlice(1.07,1.62,i,c?colors.black:colors.cream);
    ringSlice(1.62,1.7,i,c?colors.red:colors.green);
  }
  ctx.beginPath();ctx.arc(x,y,R(.159),0,Math.PI*2);ctx.fillStyle=colors.green;ctx.fill();
  ctx.beginPath();ctx.arc(x,y,R(.0635),0,Math.PI*2);ctx.fillStyle=colors.red;ctx.fill();
  // Steel wires on doubles, triples, bulls and all segment dividers.
  [1.7,1.62,1.07,.99,.159,.0635].forEach(rad=>ringStroke(rad,'#b1b9ad',Math.max(.85,r*.004)));
  ctx.strokeStyle='#b8c1b588';ctx.lineWidth=Math.max(.7,r*.003);
  for(let i=0;i<20;i++){let a=(i-.5)*Math.PI/10;let p=polar(a,.159),q=polar(a,1.7);ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);ctx.stroke();}
  ringStroke(1.78,'#0c0f0b',r*.025);
  // Numerals: sector zero is the 20 at the top, clockwise.
  ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#ede3c7';ctx.shadowColor='#000';ctx.shadowBlur=4;ctx.font=`800 ${Math.max(12,Math.min(25,r*.14))}px 'Barlow Condensed',sans-serif`;
  for(let i=0;i<20;i++){const p=polar(i*Math.PI/10,1.92);ctx.fillText(sectors[i],...p)}
  ctx.restore();
  // Studs and specular gleams.
  ctx.save();ctx.globalAlpha=.35;ctx.beginPath();ctx.arc(x,y,r*1.17,Math.PI*1.06,Math.PI*1.72);ctx.strokeStyle='#c7ad81';ctx.lineWidth=2;ctx.stroke();ctx.restore();
}
function pointOnBoard(x,y) {return{x:layout.x+R(x),y:layout.y-R(y)};}
function circleMarker(x,y,color,rad=6) {const p=pointOnBoard(x,y);ctx.save();ctx.shadowColor='#0009';ctx.shadowBlur=8;ctx.strokeStyle=color;ctx.fillStyle='#242424bb';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,rad,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();}

function render(time=0){
  if(time-lastFrame<33){requestAnimationFrame(render);return;}lastFrame=time;
  if(boardDirty){
    ctx.clearRect(0,0,layout.w,layout.h);boardDraw();
    boardBuffer.width=canvas.width;boardBuffer.height=canvas.height;
    boardBuffer.getContext('2d').drawImage(canvas,0,0);
    boardDirty=false;
  }
  ctx.clearRect(0,0,layout.w,layout.h);
  ctx.drawImage(boardBuffer,0,0,layout.w,layout.h);
  for(const dart of darts){circleMarker(dart.x,dart.y,dart.color,Math.max(4,layout.r*.025));const p=pointOnBoard(dart.x,dart.y);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+layout.r*.08,p.y-layout.r*.09);ctx.strokeStyle='#e1c698';ctx.lineWidth=3;ctx.stroke();}
  if(flight){let t=Math.min(1,(time-flight.t)/270);t=t*t*(3-2*t);const a=pointOnBoard(flight.sx,flight.sy),b=pointOnBoard(flight.x,flight.y);const x=a.x*(1-t)+b.x*t,y=a.y*(1-t)+b.y*t;
    ctx.save();ctx.strokeStyle='#f5ddab';ctx.lineWidth=9*(1-t)+2;ctx.shadowColor='#fff6';ctx.shadowBlur=10;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+45*(1-t),y+115*(1-t));ctx.stroke();ctx.restore();
    if(t>=1){darts.push({x:flight.x,y:flight.y,color:flight.color});if(darts.length>9)darts.shift();flight=null;}
  }
  if(session==='solo'||session==='online'){
    const px=layout.x+R(launchX),py=layout.h*.895;
    ctx.save();ctx.setLineDash([5,7]);ctx.strokeStyle='#e6be79a0';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(px,py-30);ctx.lineTo(px,layout.y);ctx.stroke();ctx.setLineDash([]);
    ctx.shadowColor='#000';ctx.shadowBlur=9;ctx.strokeStyle='#fae2ab';ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(px,py+18);ctx.lineTo(px,py-19);ctx.stroke();
    ctx.fillStyle='#e8b870';ctx.beginPath();ctx.moveTo(px,py-25);ctx.lineTo(px-6,py-13);ctx.lineTo(px+6,py-13);ctx.closePath();ctx.fill();
    ctx.fillStyle='#b64b40';ctx.beginPath();ctx.moveTo(px-9,py+20);ctx.lineTo(px,py+11);ctx.lineTo(px+9,py+20);ctx.lineTo(px,py+27);ctx.closePath();ctx.fill();
    if(down){ctx.strokeStyle='#ffcf71';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(down.p.x,down.p.y);ctx.lineTo(down.current.x,down.current.y);ctx.stroke();}
    ctx.restore();
  }
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
if(!window.DARTS_FIREBASE_CONFIG||window.DARTS_FIREBASE_CONFIG.apiKey==='A_REMPLACER')note('Mode solo disponible. Pour jouer en ligne, suis le guide de configuration Firebase fourni.');
