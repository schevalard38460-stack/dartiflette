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

// Firebase peut appeler la fonction d'une transaction avec null, même
// lorsqu'une salle existe sur le serveur. Un simple get() ne prépare pas
// forcément le cache interne utilisé par runTransaction().
//
// 1) onValue garde un abonnement ACTIF pendant la transaction : le cache
//    Firebase dispose alors de l'état de la salle réellement reçu du serveur.
// 2) Si la première invocation de la transaction reçoit tout de même null,
//    on s'appuie sur l'instantané reçu par le listener pour amorcer la tentative.
//    La transaction Firebase reste atomique : si l'état du serveur a changé,
//    le serveur la refuse et le SDK relance le callback avec le nouvel état.
// 3) Toute invocation suivante avec null (salle réellement supprimée) s'annule.
async function withRoomSubscription(api, roomRef, action) {
  let unsubscribe = () => {};
  let latest = null;
  let first = true;
  const ready = new Promise((resolve, reject) => {
    unsubscribe = api.onValue(roomRef, snapshot => {
      latest = snapshot.val();
      if (first) { first = false; resolve(latest); }
    }, error => {
      if (first) { first = false; reject(error); }
    });
  });
  try {
    const initial = await ready;
    if (!initial) {
      throw Error('Salle introuvable sur Firebase. Vérifie le code fourni par l’organisateur.');
    }
    return await action(() => latest);
  } finally {
    unsubscribe();
  }
}

async function transactionOnExistingRoom(api, roomRef, update) {
  return withRoomSubscription(api, roomRef, async getLatest => {
    let firstCall = true;
    let issue = '';
    const result = await api.runTransaction(roomRef, current => {
      // Cette valeur de substitution est utilisée une seule fois, seulement
      // si Firebase lance sa première tentative sans données en cache.
      const room = current === null && firstCall ? getLatest() : current;
      firstCall = false;
      if (!room) {
        issue = 'La salle a été supprimée ou fermée. Demande un nouveau code.';
        return undefined;
      }
      try {
        issue = '';
        return update(room);
      } catch (error) {
        issue = error.message || String(error);
        return undefined;
      }
    }, {applyLocally: false});
    if (!result.committed) throw Error(issue || 'Action annulée par Firebase. Réessaie.');
    return result.snapshot.val();
  });
}

export async function createOnlineRoom(name,avatar,mode,doubleOut,maxPlayers=3){
  const {uid,db,api}=await connectFirebase();
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for(let attempt=0;attempt<6;attempt++){
    const random=new Uint8Array(7);crypto.getRandomValues(random);
    const code=Array.from(random,v=>alphabet[v%alphabet.length]).join('');
    const ref=api.ref(db,path(code));
    const outcome=await api.runTransaction(ref,r=>r===null?makeRoom(uid,name,avatar,mode,doubleOut,maxPlayers):undefined,{applyLocally:false});
    if(outcome.committed)return{code,uid};
  }
  throw Error('Impossible de créer un code de partie, réessaie.');
}
export async function joinOnlineRoom(code,name,avatar){
  const {uid,db,api}=await connectFirebase();
  const ref=api.ref(db,path(code));
  await transactionOnExistingRoom(api,ref,r=>addPlayer(r,uid,name,avatar));
  return{code,uid};
}
export async function updateRoom(code,change){
  const {uid,db,api}=await connectFirebase();
  const ref=api.ref(db,path(code));
  return transactionOnExistingRoom(api,ref,r=>change(r,uid));
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

// Le mouvement du lanceur circule sur un canal éphémère séparé :
// pas de transaction sur la salle, 1 événement / 120 ms maximum.
export async function sendLiveAim(code,payload){
 const {uid,db,api}=await connectFirebase();
 return api.set(api.ref(db,`liveRooms/${code}/${uid}`),{
   x:Number(payload.x.toFixed(3)), y:Number(payload.y.toFixed(3)),
   phase:payload.phase,at:Date.now(), progress:Number(payload.progress.toFixed(3))
 });
}
export function listenLiveAim(code,onAim,onError){
 let cancel=()=>{};
 const ready=connectFirebase().then(({uid,db,api})=>{
   cancel=api.onValue(api.ref(db,`liveRooms/${code}`),snap=>{
     const values=Object.entries(snap.val()||{}).map(([id,v])=>({...v,uid:id}));
     onAim(values);
   },onError);
 });
 return()=>{cancel();ready.then(()=>cancel()).catch(()=>{});};
}
