// DARTS FRIENDS – règles communes, sans dépendance externe (navigateur et tests Node).
export const SECTORS = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
export const AVATARS = {franck:'Franck',stephane:'Stéphane',mathias:'Mathias'};
export const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
export function hitAt(x,y) {
  if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>3||Math.abs(y)>3) throw Error('Coordonnées invalides');
  const r=Math.hypot(x,y);
  if(r>1.7)return{points:0,label:'HORS CIBLE',kind:'miss',number:0,double:false};
  if(r<=.0635)return{points:50,label:'BULL 50',kind:'bull',number:50,double:true};
  if(r<=.159)return{points:25,label:'BULL 25',kind:'bull',number:25,double:false};
  const angle=Math.atan2(x,y);
  const number=SECTORS[((Math.floor((angle+Math.PI/20)/(Math.PI/10)))%20+20)%20];
  if(r>=1.62)return{points:number*2,label:`DOUBLE ${number}`,kind:'double',number,double:true};
  if(r>=.99&&r<=1.07)return{points:number*3,label:`TRIPLE ${number}`,kind:'triple',number,double:false};
  return{points:number,label:`SIMPLE ${number}`,kind:'single',number,double:false};
}
export function targetFromGesture(dx,dy,elapsedMs,startX,height,force=1,direction=1){
  const norm=700/Math.max(height,1);
  const speed=-dy*norm/Math.max(elapsedMs/1000,.045);
  const power=.5+(speed-940)*force/1320; // Valeurs conservées de la V0.3.
  return {x:clamp(startX+(dx/Math.max(-dy,1))*2.35*direction,-2.15,2.15),y:clamp(-1.7+3.4*power,-2.15,2.15),speed,angle:Math.atan2(dx,-dy)*180/Math.PI};
}
export function makeRoom(uid,name,avatar,mode=301,doubleOut=true){
  if(![301,501].includes(mode))throw Error('Mode inconnu');
  return {schema:1,createdAt:Date.now(),host:uid,mode,doubleOut:!!doubleOut,force:1,direction:1,status:'lobby',turn:0,seq:0,players:[{uid,name,avatar,score:mode,roundStart:mode,darts:0,roundHits:[]}],winner:'',lastHit:null,lastReaction:null};
}
export function addPlayer(room,uid,name,avatar){
  if(!room||room.status!=='lobby')throw Error('Cette partie a déjà commencé');
  if(room.players.some(p=>p.uid===uid))return room;
  if(room.players.length>=3)throw Error('La salle est complète');
  if(room.players.some(p=>p.avatar===avatar))throw Error('Ce personnage est déjà choisi');
  return {...room,players:[...room.players,{uid,name,avatar,score:room.mode,roundStart:room.mode,darts:0,roundHits:[]}]};
}
export function beginGame(room,uid){
  if(room.host!==uid)throw Error('Seul le créateur peut démarrer');
  if(room.players.length!==3)throw Error('Il faut trois joueurs');
  if(room.status!=='lobby'&&room.status!=='finished')throw Error('Partie déjà en cours');
  return {...room,status:'playing',turn:0,winner:'',lastHit:null,seq:(room.seq||0)+1,players:room.players.map(p=>({...p,score:room.mode,roundStart:room.mode,darts:0,roundHits:[]}))};
}
export function applyThrow(room,uid,x,y){
  if(room.status!=='playing')throw Error('La partie n’est pas en cours');
  const idx=room.turn,p=room.players[idx];
  if(!p||p.uid!==uid)throw Error('Ce n’est pas ton tour');
  const hit=hitAt(x,y),remaining=p.score-hit.points;
  const bust=remaining<0||(room.doubleOut&&(remaining===1||(remaining===0&&!hit.double)));
  const won=remaining===0&&!bust;
  const players=room.players.map(v=>({...v}));
  const current=players[idx];
  const dartNumber=current.darts+1;
  current.darts=dartNumber;
  const roundHits=[...(current.roundHits||[]),{points:hit.points,kind:hit.kind,number:hit.number}];
  current.roundHits=roundHits;
  let quip='';
  if(hit.kind==='miss')quip='Miskine !';
  else if(hit.kind==='triple'&&hit.number===1)quip='Triple buse !';
  else if(hit.kind==='double'&&hit.number<=3)quip=`C’est deux fois mieux que ${hit.number} !`;
  else if(hit.kind==='triple'&&hit.number===20)quip='Tocar !';
  if(roundHits.filter(h=>h.kind==='single'&&h.number===1).length===2 && hit.kind==='single'&&hit.number===1)quip='Atika, roi des uns !';
  if(roundHits.length===3&&roundHits.reduce((a,h)=>a+h.points,0)===26)quip='Hihihi 26 !';
  if(roundHits.length>=2&&roundHits.slice(-2).every(h=>h.points>=54))quip='I’m a Chairman !';
  current.score=bust?current.roundStart:remaining;
  const next={...room,players,seq:(room.seq||0)+1,
    lastHit:{seq:(room.seq||0)+1,uid,x:Math.round(x*10000)/10000,y:Math.round(y*10000)/10000,...hit,bust,won,dartNumber,quip,at:Date.now()}};
  if(won){next.status='finished';next.winner=uid;}
  else if(bust||dartNumber>=3){next.turn=(idx+1)%players.length;players[next.turn].roundStart=players[next.turn].score;players[next.turn].darts=0;players[next.turn].roundHits=[];}
  return next;
}
export function reactionFor(room){
  const h=room.lastHit;if(!h)return '';
  if(h.kind==='miss')return 'Miskine !';
  if(h.kind==='triple'&&h.number===1)return 'Triple buse !';
  if(h.kind==='double'&&h.number<=3)return `C’est deux fois mieux que ${h.number} !`;
  if(h.kind==='triple'&&h.number===20)return 'Tocar !';
  return '';
}
