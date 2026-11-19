// Adaptateur Firebase Realtime Database – aucun serveur personnel à administrer.
// L'application télécharge le SDK officiel uniquement lors d'une connexion en ligne.
import {makeRoom,addPlayer,beginGame,applyThrow} from './rules.mjs';
let initialized = null;
export async function connectFirebase(){
  if(initialized)return initialized;
  const cfg=window.DARTS_FIREBASE_CONFIG;
  if(!cfg||!cfg.apiKey||cfg.apiKey==='A_REMPLACER'||!cfg.databaseURL||cfg.projectId==='VOTRE-PROJET')
    throw Error('Firebase n’est pas encore configuré : suivre le guide du ZIP.');
  try{
    const [app,auth,database]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/13.3.0/firebase-database.js')
    ]);
    const fb=app.initializeApp(cfg);
    const a=auth.getAuth(fb);
    if(!a.currentUser)await auth.signInAnonymously(a);
    const db=database.getDatabase(fb);
    initialized={uid:a.currentUser.uid,db,api:database};
    return initialized;
  }catch(e){throw Error('Connexion Firebase impossible : '+(e.code||e.message));}
}
function path(code){return 'rooms/'+code;}
export async function createOnlineRoom(name,avatar,mode,doubleOut){
  const {uid,db,api}=await connectFirebase();
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for(let attempt=0;attempt<6;attempt++){
    const random=new Uint8Array(7);crypto.getRandomValues(random);
    const code=Array.from(random,v=>alphabet[v%alphabet.length]).join('');
    const ref=api.ref(db,path(code));
    const outcome=await api.runTransaction(ref,r=>r===null?makeRoom(uid,name,avatar,mode,doubleOut):undefined,{applyLocally:false});
    if(outcome.committed)return{code,uid};
  }
  throw Error('Impossible de créer un code de partie, réessaie.');
}
export async function joinOnlineRoom(code,name,avatar){
  const {uid,db,api}=await connectFirebase();
  const ref=api.ref(db,path(code));let issue='';
  const result=await api.runTransaction(ref,r=>{
    if(!r){issue='Salle introuvable';return undefined;}
    try{return addPlayer(r,uid,name,avatar);}catch(e){issue=e.message;return undefined;}
  },{applyLocally:false});
  if(!result.committed)throw Error(issue||'Impossible de rejoindre la salle');
  return{code,uid};
}
export async function updateRoom(code,change){
  const {uid,db,api}=await connectFirebase();
  let problem='';
  const result=await api.runTransaction(api.ref(db,path(code)),r=>{
    if(!r){problem='Salle introuvable';return undefined;}
    try{return change(r,uid);}catch(e){problem=e.message;return undefined;}
  },{applyLocally:false});
  if(!result.committed)throw Error(problem||'Action refusée');
  return result.snapshot.val();
}
export async function setSettings(code,force,direction){
  return updateRoom(code,(r,uid)=>{
    if(r.host!==uid||r.status!=='lobby')throw Error('Seul le créateur peut régler la sensibilité avant la partie');
    return{...r,force,direction};
  });
}
export function startOnline(code){return updateRoom(code,(r,uid)=>beginGame(r,uid));}
export function throwOnline(code,x,y){return updateRoom(code,(r,uid)=>applyThrow(r,uid,x,y));}
export function teaseOnline(code,target){return updateRoom(code,(r,uid)=>{
  if(!r.players.some(p=>p.uid===uid)||!r.players.some(p=>p.uid===target)||target===uid)throw Error('Choisis un autre joueur');
  if(r.lastReaction?.by===uid&&Date.now()-r.lastReaction.at<8000)throw Error('Attends quelques secondes pour chambrer encore !');
  return {...r, lastReaction:{seq:(r.lastReaction?.seq||0)+1,by:uid,target,at:Date.now(),text:'Tocar !'}};
});}
export function listenRoom(code,onState,onError){
  let cancel=()=>{};
  const ready=connectFirebase().then(({db,api})=>{
    cancel=api.onValue(api.ref(db,path(code)),snap=>onState(snap.val()),error=>onError(error));
  });
  return()=>{cancel();ready.then(()=>cancel()).catch(()=>{});};
}
