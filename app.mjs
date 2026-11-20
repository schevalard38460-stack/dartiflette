import {SECTORS,clamp,makeRoom,applyThrow,targetFromFlick,hitAt} from './rules.mjs';
import {shotShow,progressFlight,launchAreaStart} from './show.mjs';
import {drawCompetitionDart,dartAppearanceFor} from './dart-render.mjs';
import {flightPose} from './flight-path.mjs';
import {createGameAudio} from './audio.mjs';
import {opponentReaction,teaseReaction} from './reactions.mjs';
import {createOnlineRoom,joinOnlineRoom,listenRoom,connectFirebase,setSettings,startOnline,throwOnline,teaseOnline,sendLiveAim,listenLiveAim} from './firebase-net.mjs';
const $=id=>document.getElementById(id);
const canvas=$('board'),ctx=canvas.getContext('2d');
const sectors=SECTORS;
const colors={red:'#b34738',green:'#36704f',black:'#202522',cream:'#ead5ab'};
let layout={x:0,y:0,r:200,w:600,h:600},darts=[],flight=null,impact=null,down=null,marker=null,launchX=0;
const boardBuffer=document.createElement('canvas');let boardDirty=true,lastFrame=0;
let session='menu',room=null,roomCode='',uid='',avatar='stephane',stopListener=null,stopLive=null,busy=false;
let lastShotSeq=0,lastReactionSeq=0,solo=null,lastToast=null,revealState=null;
let remoteAim=null,lastAimMsg=0, liveQueue=Promise.resolve(), liveStreamEpoch=0;
let lastLiveSeen=0;
let visualPrefs={show:true,sound:true,voices:true};
try{
  visualPrefs.show=localStorage.getItem('df-cinema')!=='false';
  visualPrefs.sound=localStorage.getItem('df-sound')!=='false';
  visualPrefs.voices=localStorage.getItem('df-voices')!=='false';
}catch{}
const gameAudio=createGameAudio({soundEnabled:()=>visualPrefs.sound,voicesEnabled:()=>visualPrefs.voices});
$('cinematic').checked=visualPrefs.show;
$('sound-fx').checked=visualPrefs.sound;
$('voice-fx').checked=visualPrefs.voices;
$('cinematic').addEventListener('change',e=>{visualPrefs.show=e.target.checked;try{localStorage.setItem('df-cinema',String(visualPrefs.show));}catch{}});
$('sound-fx').addEventListener('change',e=>{visualPrefs.sound=e.target.checked;if(visualPrefs.sound)gameAudio.unlock();try{localStorage.setItem('df-sound',String(visualPrefs.sound));}catch{}});
$('voice-fx').addEventListener('change',e=>{visualPrefs.voices=e.target.checked;try{localStorage.setItem('df-voices',String(visualPrefs.voices));}catch{}});
// Android interdit généralement le son automatique avant un geste de l'utilisateur.
document.addEventListener('pointerdown',()=>gameAudio.unlock(),{once:true,passive:true});
let reactionTimer=null;
function showReaction(react){
  if(!react)return;
  const box=$('reaction-bubble'),img=$('reaction-avatar');
  img.src=`assets/${['franck','stephane','mathias'].includes(react.avatar)?react.avatar:'invite'}.${react.avatar==='invite'?'svg':'webp'}`;
  $('reaction-name').textContent=react.name;
  $('reaction-text').textContent=`« ${react.text} »`;
  box.classList.add('visible');clearTimeout(reactionTimer);
  reactionTimer=setTimeout(()=>box.classList.remove('visible'),3100);
  if(visualPrefs.sound){
    gameAudio.speak(react.text,react.avatar);
    if(react.mood==='cheer')gameAudio.play('cheer',{gain:.32,delay:.14});
    else if(react.mood==='groan')gameAudio.play('groan',{gain:.3,delay:.13});
  }
}
const savedName=()=>{try{return localStorage.getItem('df-name')}catch{return null}};
$('nickname').value=savedName()||'Stéphane';
const invite=new URL(location.href).searchParams.get('room');
if(invite && /^[A-HJ-NP-Z2-9]{7}$/.test(invite.toUpperCase()))$('room-input').value=invite.toUpperCase();
function safe(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function playerName(){const n=$('nickname').value.trim().slice(0,18)||'Joueur';try{localStorage.setItem('df-name',n)}catch{}return n;}
function note(s){$('online-note').textContent=s;}
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('visible');clearTimeout(lastToast);lastToast=setTimeout(()=>$('toast').classList.remove('visible'),3100);}
function badge(msg){$('shot-badge').textContent=msg;$('shot-badge').classList.add('visible');setTimeout(()=>$('shot-badge').classList.remove('visible'),1000);}
function show(page){for(const id of ['setup','lobby','match'])$(id).classList.toggle('hidden',id!==page);document.body.dataset.screen=page;if(page==='match')window.scrollTo(0,0);}
function enableButtons(yes){$('create').disabled=!yes||Number($('player-count').value)===1;$('join').disabled=!yes;}
function setAvatar(a){avatar=a;document.querySelectorAll('.avatar-choice').forEach(el=>{const active=el.dataset.avatar===a;el.classList.toggle('selected',active);el.setAttribute('aria-pressed',String(active));});$('nickname').value={stephane:'Stéphane',franck:'Franck',mathias:'Mathias',invite:'Invité'}[a];}
for(const el of document.querySelectorAll('.avatar-choice'))el.addEventListener('click',()=>setAvatar(el.dataset.avatar));
function sensitive(id,output){$(id).addEventListener('input',()=>$(output).textContent=Number($(id).value).toFixed(2)+'×');}
for(const a of [['solo-force','solo-force-value'],['solo-direction','solo-direction-value'],['force-sensitivity','force-value'],['direction-sensitivity','direction-value']])sensitive(...a);
function playerLine(p,i,active=false){
  const face=['franck','stephane','mathias'].includes(p.avatar)?p.avatar:'invite';
  return `<div class="player ${active?'active':''}"><img class="avatar-portrait" src="assets/${face}${face==='invite'?'.svg':'.webp'}" alt=""><div class="player-details"><strong>${safe(p.name)}</strong><small>${active?'À LA CIBLE':`JOUEUR ${i+1}`}</small></div>${Number.isFinite(p.score)?`<div class="score-wrap"><span class="points">${p.score}</span><small class="dart-count">${'●'.repeat(p.darts||0)}${'○'.repeat(3-(p.darts||0))}</small></div>`:''}</div>`;
}
function renderState(){
  const official=session==='solo'?solo:room;
  const current=flight&&!flight.finished&&revealState?revealState:official;
  if(!current)return;
  const playing=current.status==='playing',finished=current.status==='finished';
  if(session==='online'&&current.status==='lobby'){
    show('lobby');$('room-code').textContent=roomCode;
    $('lobby-players').innerHTML=current.players.map((p,i)=>playerLine({...p,score:undefined},i)).join('');
    const host=current.host===uid;$('host-controls').classList.toggle('hidden',!host);
    if(document.activeElement!==$('force-sensitivity'))$('force-sensitivity').value=current.force;
    if(document.activeElement!==$('direction-sensitivity'))$('direction-sensitivity').value=current.direction;
    $('force-value').textContent=Number(current.force).toFixed(2)+'×';$('direction-value').textContent=Number(current.direction).toFixed(2)+'×';
    $('lobby-note').textContent=`${current.players.length}/${current.maxPlayers||3} joueurs · Sensibilité force ${current.force.toFixed(2)}× / direction ${current.direction.toFixed(2)}×. ${current.players.length<(current.maxPlayers||3)?'En attente des autres…':'Prêts !'}`;
    $('start').classList.toggle('hidden',!host||current.players.length!==(current.maxPlayers||3));
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
  $('live-description').textContent=finished?'Partie terminée':`🎯 ${active.name}`;
  $('live-detail').textContent=active.uid===uid?'Ton lancer':'Visée de ton adversaire';
  $('spectator-state').textContent=finished?'🏆 Partie terminée':active.uid===uid?'🎯 À toi de jouer : les autres voient ta visée en direct':`👀 EN DIRECT : ${active.name} prépare sa fléchette…`; 
  $('dart-counter').textContent=finished?'':`Fléchette ${(active.darts||0)+1}/3`;
  const last=current.lastHit;if(last){$('last-shot').textContent=`${current.players.find(p=>p.uid===last.uid)?.name||''} : ${last.label}${last.bust?' — BUST':''}`;$('quip').textContent=last.quip||'';}
  const winner=current.players.find(p=>p.uid===current.winner);
  $('win-banner').textContent=winner?`🏆 ${winner.name} A GAGNÉ !`:'';
  $('win-banner').classList.toggle('hidden',!finished);
  $('restart').classList.toggle('hidden',session==='online'?(current.host!==uid||!finished):!finished);
  $('banter').classList.toggle('hidden',session!=='online');
  $('tease-target').innerHTML=current.players.filter(p=>p.uid!==uid).map(p=>`<option value="${safe(p.uid)}">${safe(p.name)}</option>`).join('');
}
function handleLive(values){
  if(session!=='online'||!room||room.status!=='playing')return;
  const active=room.players[room.turn];
  if(!active||active.uid===uid){remoteAim=null;return;}
  const aim=values.find(v=>v.uid===active.uid);
  if(!aim||!['aim','flick','release'].includes(aim.phase))return;
  const newMessage=aim.at!==lastAimMsg;
  if(!newMessage)return;
  remoteAim={...aim,seen:performance.now()};lastAimMsg=aim.at;lastLiveSeen=performance.now();
  $('live-description').textContent=`🔴 ${active.name} en direct`;
  $('live-detail').textContent=aim.phase==='flick'?'Lance sa fléchette…':aim.phase==='release'?'Fléchette lancée !':'Ajuste sa visée…';
  $('spectator-state').textContent=`👀 ${active.name} : ${aim.phase==='aim'?'positionne sa fléchette':aim.phase==='flick'?'effectue son lancer':'vient de lancer'} · position ${Math.round(aim.x*100)/100}`;
}
function startLiveObserver(){
  stopLive?.();stopLive=listenLiveAim(roomCode,handleLive,()=>{});
}
function sendAim(phase,x,y,progress,force=false){
  if(session!=='online'||!roomCode||!allowedTurn())return;
  const now=performance.now();if(!force&&now-lastLiveSeen<75)return;
  lastLiveSeen=now;
  const code=roomCode,epoch=liveStreamEpoch;
  liveQueue=liveQueue.catch(()=>{}).then(()=>epoch===liveStreamEpoch&&code===roomCode?sendLiveAim(code,{phase,x,y,progress}):undefined).catch(()=>{});
}
function handleState(next){
  if(!next){toast('Cette salle n’existe plus');leave();return;}
  const roomBeforeUpdate=room;
  const previousStatus=room?.status,previousLast=room?.lastHit?.seq||0;
  const previousReact=room?.lastReaction?.seq||0;
  room=next;session='online';
  if(next.status!=='playing')remoteAim=null;
  if(next.lastHit&&next.lastHit.seq!==previousLast){
    revealState=previousStatus==='playing'?roomBeforeUpdate:null;
    const h=next.lastHit;animateHit(h);
  }
  if(next.lastReaction&&next.lastReaction.seq!==previousReact&&roomBeforeUpdate){
    const reaction=teaseReaction(next.lastReaction,next.players);
    toast(`${reaction.name} : Tocar !`);showReaction(reaction);
  }
  if(next.status==='playing'&&previousStatus==='lobby')toast('La partie commence !');
  renderState();
}
function leave(){liveStreamEpoch++;gameAudio.stop();$('reaction-bubble').classList.remove('visible');revealState=null;impact=null;$('cinema-overlay').classList.remove('active');if(stopLive){stopLive();stopLive=null;}if(stopListener){stopListener();stopListener=null;}remoteAim=null;room=null;roomCode='';solo=null;busy=false;down=null;darts=[];flight=null;launchX=0;session='menu';show('setup');}
async function attempt(task){enableButtons(false);note('Connexion sécurisée à Firebase…');try{await task();note('Prêt !');}catch(e){toast(e.message);note(e.message);}finally{enableButtons(true);}}
$('create').addEventListener('click',()=>attempt(async()=>{
  const data=await createOnlineRoom(playerName(),avatar,Number($('game-mode').value),$('checkout').value==='true',Number($('player-count').value));
  uid=data.uid;roomCode=data.code;session='online';lastShotSeq=0;lastReactionSeq=0;
  stopListener=listenRoom(roomCode,handleState,e=>toast(e.message));startLiveObserver();
}));
$('join').addEventListener('click',()=>attempt(async()=>{
  const code=$('room-input').value.trim().toUpperCase();if(!/^[A-HJ-NP-Z2-9]{7}$/.test(code))throw Error('Entre le code à 7 caractères envoyé par ton ami');
  const data=await joinOnlineRoom(code,playerName(),avatar);
  uid=data.uid;roomCode=code;session='online';lastShotSeq=0;lastReactionSeq=0;
  stopListener=listenRoom(roomCode,handleState,e=>toast(e.message));startLiveObserver();
}));
$('player-count').addEventListener('change',()=>{const solo=Number($('player-count').value)===1;$('create').disabled=solo;$('create').textContent=solo?'Choisis 2, 3 ou 4 joueurs pour le multijoueur':'Créer une salle privée →';});
$('show-preview').addEventListener('click',()=>{gameAudio.unlock();$('practice').click();requestAnimationFrame(()=>localShot(0,1.03));});
$('test-audio').addEventListener('click',()=>{gameAudio.unlock();gameAudio.play('release');gameAudio.play('flight',{delay:.18});gameAudio.play('impact',{delay:.73});setTimeout(()=>showReaction({name:'Franck',avatar:'franck',text:'Tocar !',mood:'cheer'}),960);});
$('practice').addEventListener('click',()=>{
  leave();uid='solo';solo={...makeRoom(uid,playerName(),avatar,Number($('game-mode').value),$('checkout').value==='true'),status:'playing'};
  session='solo';$('last-shot').textContent='À toi de jouer !';$('quip').textContent='';renderState();
});
$('save-sensitivity').addEventListener('click',async()=>{
  try{await setSettings(roomCode,Number($('force-sensitivity').value),Number($('direction-sensitivity').value));toast('Réglage appliqué à tous les joueurs');}catch(e){toast(e.message);}
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
function localShot(x,y){const before=solo;solo=applyThrow(solo,uid,x,y);revealState=before;const h=solo.lastHit;animateHit(h);renderState();}
function animateHit(hit){
  if(!hit)return;
  // Spectateurs et tireur voient exactement la même trajectoire à partir du résultat validé.
  const fx=shotShow(hit),duration=visualPrefs.show?fx.duration:430;
  const activeState=session==='solo'?solo:room;
  const dartStyle=dartAppearanceFor(activeState?.players||[],hit.uid,avatar);
  const reaction=opponentReaction(hit,activeState?.players||[],avatar);
  const start=pointOnBoard(launchX,0);
  // Le tir prend son envol depuis le bas, à l'endroit choisi par le lanceur.
  const fromX=hit.uid===uid?layout.x+R(launchX):(remoteAim?.phase==='release'?layout.x+R(remoteAim.x):start.x);
  flight={x:hit.x,y:hit.y,fromX,fromY:layout.h*.64,t:performance.now(),duration,
    slow:visualPrefs.show&&fx.slow,fx,label:hit.label||'',bust:!!hit.bust,won:!!hit.won,
    miss:hit.kind==='miss',style:dartStyle,reaction,
    side:((hit.seq||1)%2===0?1:-1),
    color:hit.bust?'#ef7863':hit.won?'#ffe1a0':'#f4ead2',finished:false};
  impact=null;
  const overlay=$('cinema-overlay');
  if(visualPrefs.show&&fx.slow){
    $('cinema-title').textContent='AU RALENTI';
    $('cinema-subtitle').textContent=fx.kind==='win'?'DERNIÈRE FLÉCHETTE — SUSPENSE…':'LE TEMPS S’ARRÊTE…';
    overlay.classList.add('active');overlay.classList.remove('impact');
  }else overlay.classList.remove('active','impact');
  gameAudio.play('flight',{gain:flight.slow?.5:.68,rate:flight.slow?.72:1.05});
}
function coordinates(e){const rect=canvas.getBoundingClientRect();return{x:e.clientX-rect.left,y:e.clientY-rect.top};}
function launchZoneY(){return launchAreaStart(layout.h);}
function placement(p){return clamp((p.x-layout.x)/layout.r*1.7,-1.55,1.55);}
canvas.addEventListener('pointerdown',e=>{
  if(!allowedTurn()){toast(session==='online'?'Attends ton tour !':'Démarre une partie');return;}
  if(busy || (flight && performance.now()-flight.t<flight.duration+220)){toast('Attends que la fléchette atteigne la cible !');return;}
  const p=coordinates(e);if(p.y<launchZoneY()){toast('Pose ton doigt dans la grande zone LANCER en bas');return;}
  down={p,current:p,time:performance.now(),id:e.pointerId,initialX:launchX,samples:[{x:p.x,y:p.y,t:performance.now()}]};
  canvas.setPointerCapture(e.pointerId);sendAim('aim',launchX,-1.4,0,true);
});
canvas.addEventListener('pointermove',e=>{
 if(!down||down.id!==e.pointerId)return;
 down.current=coordinates(e);
 const now=performance.now();down.samples.push({x:down.current.x,y:down.current.y,t:now});
 if(down.samples.length>28)down.samples.shift();
 const dx=down.current.x-down.p.x,dy=down.current.y-down.p.y;
 const placing=Math.abs(dx)>Math.abs(dy)*1.3||Math.abs(dy)<19;
 if(placing)launchX=placement(down.current);
 if(dy<-20){
   let predX=down.initialX,predY=-1.2;
   try{const m=targetFromFlick(down.samples,down.initialX,layout.h,session==='solo'?Number($('solo-force').value):room.force,session==='solo'?Number($('solo-direction').value):room.direction);predX=m.x;predY=m.y;}catch{}
   sendAim('flick',predX,predY,clamp(-dy/Math.max(layout.h*.35,1),0,1));
 }else sendAim('aim',launchX,-1.3,0);
});
canvas.addEventListener('pointerup',async e=>{
  if(!down||down.id!==e.pointerId)return;
  const p=coordinates(e),dx=p.x-down.p.x,dy=p.y-down.p.y,now=performance.now();
  down.samples.push({x:p.x,y:p.y,t:now});
  if(dy>=-32||Math.abs(dx)>Math.abs(dy)*1.4){
    launchX=placement(p);down=null;sendAim('aim',launchX,-1.3,0,true);
    if(Math.abs(dx)>8)toast('Fléchette positionnée');return;
  }
  launchX=down.initialX;
  const current=session==='solo'?solo:room;
  let target;
  try{target=targetFromFlick(down.samples,launchX,layout.h,session==='solo'?Number($('solo-force').value):current.force,session==='solo'?Number($('solo-direction').value):current.direction)}
  catch(error){down=null;toast(error.message);return;}
  down=null;sendAim('release',target.x,target.y,1,true);
  gameAudio.play('release',{gain:.65});
  busy=true;
  try{if(session==='solo')localShot(target.x,target.y);else await throwOnline(roomCode,target.x,target.y);}
  catch(e){toast(e.message);}finally{busy=false;}
});
canvas.addEventListener('pointercancel',()=>{if(down)launchX=down.initialX;down=null;sendAim('aim',launchX,-1.3,0,true);});

function resize() {
  const rect=canvas.getBoundingClientRect();
  const dpr=Math.min(2,window.devicePixelRatio||1);
  canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  layout={w:rect.width,h:rect.height,x:rect.width*.5,y:rect.height*.29,r:Math.min(rect.width*.37,rect.height*.205)};boardDirty=true;
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

function drawFlickLane(){
  const top=launchZoneY(),bottom=layout.h*.965,mid=layout.w/2;
  ctx.save();
  const gradient=ctx.createLinearGradient(0,top,0,bottom);
  gradient.addColorStop(0,'#e7ad6415');gradient.addColorStop(.55,'#c5934930');gradient.addColorStop(1,'#c5934910');
  ctx.fillStyle=gradient;ctx.fillRect(9,top,layout.w-18,bottom-top);
  ctx.strokeStyle='#ffcb7585';ctx.lineWidth=1.5;ctx.setLineDash([7,7]);ctx.beginPath();ctx.moveTo(18,top);ctx.lineTo(layout.w-18,top);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#f8dfb5c4';ctx.textAlign='center';ctx.font=`700 ${Math.min(14,Math.max(10,layout.w*.03))}px 'DM Sans',sans-serif`;
  ctx.fillText('ZONE DE LANCER · GLISSER VERS LE HAUT',mid,Math.min(bottom-8,top+20));
  // Règle verticale de puissance à gauche
  ctx.globalAlpha=.42;ctx.strokeStyle='#f8d99e';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(25,top+29);ctx.lineTo(25,bottom-25);ctx.stroke();
  for(let i=0;i<=8;i++){let y=top+29+(bottom-top-54)*i/8;ctx.beginPath();ctx.moveTo(25,y);ctx.lineTo(i%2?31:37,y);ctx.stroke();}
  ctx.restore();
}
function showImpactEffect(time){
  if(!impact)return;
  const t=(time-impact.t)/650;if(t>=1){impact=null;return;}
  const pos=pointOnBoard(impact.x,impact.y);
  ctx.save();ctx.globalAlpha=Math.max(0,1-t);
  for(let i=0;i<3;i++){ctx.strokeStyle=impact.color;ctx.lineWidth=3-i*.6;ctx.beginPath();ctx.arc(pos.x,pos.y,6+(t*45)+i*8,0,Math.PI*2);ctx.stroke();}
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6;const length=t*layout.r*.2;
    ctx.strokeStyle=i%2===0?'#fff4cc':impact.color;ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(pos.x+Math.cos(a)*length,pos.y+Math.sin(a)*length);ctx.lineTo(pos.x+Math.cos(a)*(length+12*(1-t)),pos.y+Math.sin(a)*(length+12*(1-t)));ctx.stroke();
  }ctx.restore();
}
function render(time=0){
  if(time-lastFrame<16){requestAnimationFrame(render);return;}lastFrame=time;
  if(boardDirty){
    ctx.clearRect(0,0,layout.w,layout.h);boardDraw();
    boardBuffer.width=canvas.width;boardBuffer.height=canvas.height;
    boardBuffer.getContext('2d').drawImage(canvas,0,0);
    boardDirty=false;
  }
  ctx.clearRect(0,0,layout.w,layout.h);
  ctx.drawImage(boardBuffer,0,0,layout.w,layout.h);
  if((session==='solo'||session==='online')&&((session==='solo'&&solo?.status==='playing')||(session==='online'&&room?.status==='playing')))drawFlickLane();
  for(const dart of darts){
    if(dart.miss)continue;
    const p=pointOnBoard(dart.x,dart.y);
    // La pointe est enfoncée dans la cible; fût et ailettes dépassent.
    ctx.save();ctx.shadowColor='#080e0bcc';ctx.shadowBlur=5;
    drawCompetitionDart(ctx,p.x,p.y,dart.angle??-Math.PI/2,.35,1,dart.style||'invite');
    ctx.restore();
  }
  if(flight && !flight.finished){
    const elapsed=time-flight.t;
    const raw=Math.min(1,elapsed/flight.duration);
    const q=progressFlight(raw,flight.slow);
    const dest=pointOnBoard(flight.x,flight.y);
    // Courbe balistique cubique, perspective et rotation du projectile.
    // L'impact final et la précision sont inchangés : seules les images bougent.
    const pose=flightPose(flight.fromX,flight.fromY,dest.x,dest.y,q,layout.r,flight.side);
    const scale=.85-.50*q;
    ctx.save();
    ctx.lineCap='round';ctx.lineJoin='round';
    ctx.beginPath();
    for(let i=0;i<=14;i++){
      const f=Math.max(0,q-.18)+Math.min(.18,q)*i/14;
      const v=flightPose(flight.fromX,flight.fromY,dest.x,dest.y,f,layout.r,flight.side);
      if(i===0)ctx.moveTo(v.x,v.y);else ctx.lineTo(v.x,v.y);
    }
    ctx.strokeStyle=flight.slow?'#f7c98599':'#e5e7e078';
    ctx.lineWidth=4-2*q;ctx.shadowColor='#fff1d0';ctx.shadowBlur=flight.slow?13:7;ctx.stroke();ctx.restore();
    drawCompetitionDart(ctx,pose.x,pose.y,pose.angle,scale,1,flight.style);
    if(raw>=1&&!flight.finished){
      flight.finished=true;
      darts.push({x:flight.x,y:flight.y,angle:pose.angle,color:flight.color,miss:flight.miss,style:flight.style});if(darts.length>9)darts.shift();
      impact={x:flight.x,y:flight.y,t:time,color:flight.fx.kind==='great'||flight.fx.kind==='perfect'||flight.won?'#ffd477':'#d6ccb1'};
      badge(flight.won?'🏆 VICTOIRE !':flight.bust?'BUST !':flight.fx.title||flight.label);
      if(flight.slow){$('cinema-title').textContent=flight.fx.title;$('cinema-subtitle').textContent=flight.won?'MAGNIFIQUE FINISH !':'QUELLE FLÉCHETTE !';$('cinema-overlay').classList.add('impact');}
      gameAudio.play(flight.miss?'miss':flight.won||flight.fx.slow?'big_hit':'impact',{gain:flight.miss?.54:1});
      if(flight.reaction)showReaction(flight.reaction);
      revealState=null;renderState();
      const currentFlight=flight;
      setTimeout(()=>{if(flight===currentFlight){flight=null;$('cinema-overlay').classList.remove('active','impact');}},850);
    }
  }
  showImpactEffect(time);
  // Fléchette spectateur, sans défilement supplémentaire ni vidéo : canal Firebase dédié.
  if(remoteAim&&!flight&&session==='online'&&room?.status==='playing'&&room.players[room.turn]?.uid!==uid&&time-remoteAim.seen<3500){
    const px=layout.x+R(remoteAim.x),baseY=layout.h*.64;
    const dest=pointOnBoard(remoteAim.x,remoteAim.y);
    const move=remoteAim.phase==='aim'?0:remoteAim.phase==='release'?1:clamp(remoteAim.progress,0,1);
    const y=baseY+(dest.y-baseY)*move;
    ctx.save();ctx.strokeStyle='#82e9d9';ctx.fillStyle='#8ff6e9';ctx.shadowBlur=15;ctx.shadowColor='#53e7d4';ctx.lineWidth=3;
    ctx.setLineDash([6,5]);ctx.beginPath();ctx.moveTo(px,baseY);ctx.lineTo(dest.x,dest.y);ctx.stroke();ctx.setLineDash([]);
    ctx.beginPath();ctx.arc(dest.x,dest.y,Math.max(9,layout.r*.05),0,Math.PI*2);ctx.stroke();
    drawCompetitionDart(ctx,px,y,-Math.PI/2,.65,.77,dartAppearanceFor(room?.players||[],room?.players[room?.turn]?.uid,'invite'));
    ctx.restore();
  }
  if((session==='solo'||session==='online')&&allowedTurn()&&!flight){
    const px=layout.x+R(launchX),py=layout.h*.64;
    ctx.save();ctx.setLineDash([5,7]);ctx.strokeStyle='#e6be796e';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(px,py-30);ctx.lineTo(px,launchZoneY());ctx.stroke();ctx.setLineDash([]);
    drawCompetitionDart(ctx,px,py,-Math.PI/2,.72,1,avatar);
    if(down){ctx.strokeStyle='#ffcf71';ctx.lineWidth=3;ctx.shadowColor='#e8a650';ctx.shadowBlur=11;ctx.beginPath();ctx.moveTo(down.p.x,down.p.y);ctx.lineTo(down.current.x,down.current.y);ctx.stroke();}
    ctx.restore();
  }
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
if(!window.DARTS_FIREBASE_CONFIG||window.DARTS_FIREBASE_CONFIG.apiKey==='A_REMPLACER')note('Mode solo disponible. Pour jouer en ligne, suis le guide de configuration Firebase fourni.');
