import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRoom,addPlayer,beginGame,applyThrow,hitAt,targetFromGesture} from '../rules.mjs';
const d=(r,a)=>{let x=Math.sin(a*Math.PI/180)*r,y=Math.cos(a*Math.PI/180)*r;return[x,y];};
function trio(mode=301,doubleOut=true){
 let room=makeRoom('s','Stéphane','stephane',mode,doubleOut);
 room=addPlayer(room,'f','Franck','franck');room=addPlayer(room,'m','Mathias','mathias');
 return beginGame(room,'s');
}
test('cible - triples, doubles et bull',()=>{
 assert.equal(hitAt(0,1.03).points,60);
 assert.equal(hitAt(0,1.66).points,40);
 assert.equal(hitAt(0,0).points,50);
 assert.equal(hitAt(2,2).points,0);
 assert.equal(hitAt(...d(1.03,18)).points,3);
 assert.equal(hitAt(...d(1.66,18)).points,2);
});
test('la vitesse influe la hauteur, et la pente la dérive',()=>{
 const slow=targetFromGesture(0,-190,500,.5,600),quick=targetFromGesture(0,-190,140,.5,600);
 assert.ok(quick.y>slow.y);assert.equal(quick.x,.5);
 assert.ok(targetFromGesture(65,-190,140,.5,600).x>quick.x);
});
test('une salle reste limitée à 3 joueurs, avatars distincts',()=>{
 let r=makeRoom('s','S','stephane');r=addPlayer(r,'f','F','franck');
 assert.throws(()=>addPlayer(r,'z','Z','franck'));
 r=addPlayer(r,'m','M','mathias');
 assert.throws(()=>addPlayer(r,'x','X','stephane'));
 assert.equal(r.players.length,3);
});
test('seul le créateur lance une partie complète',()=>{
 let r=makeRoom('s','S','stephane');assert.throws(()=>beginGame(r,'s'));
 r=addPlayer(r,'f','F','franck');r=addPlayer(r,'m','M','mathias');
 assert.throws(()=>beginGame(r,'f'));assert.equal(beginGame(r,'s').status,'playing');
});
test('tour: 3 lancers et passage au suivant',()=>{
 let r=trio();for(let i=0;i<3;i++)r=applyThrow(r,'s',2,2);
 assert.equal(r.turn,1);assert.equal(r.players[0].score,301);assert.equal(r.players[1].darts,0);
 assert.throws(()=>applyThrow(r,'s',0,1.03));
 r=applyThrow(r,'f',0,1.03);assert.equal(r.players[1].score,241);
});
test('bust: score restauré et changement de joueur',()=>{
 let r=trio();r.players[0].score=10;r.players[0].roundStart=10;
 r=applyThrow(r,'s',0,1.03);assert.equal(r.players[0].score,10);assert.equal(r.turn,1);assert.equal(r.lastHit.bust,true);
});
test('double-out: sortie non double refusée',()=>{
 let r=trio();r.players[0].score=20;r.players[0].roundStart=20;
 r=applyThrow(r,'s',0,1.3);assert.equal(r.players[0].score,20);assert.equal(r.lastHit.bust,true);
});
test('double-out: victoire valide sur double 20',()=>{
 let r=trio();r.players[0].score=40;r.players[0].roundStart=40;
 r=applyThrow(r,'s',0,1.66);assert.equal(r.winner,'s');assert.equal(r.status,'finished');
});
test('fin libre: 20 simple peut gagner',()=>{
 let r=trio(501,false);r.players[0].score=20;r.players[0].roundStart=20;
 r=applyThrow(r,'s',0,1.3);assert.equal(r.status,'finished');
});
test('double-out avec 1 restant déclenche bust',()=>{
 let r=trio();r.players[0].score=2;r.players[0].roundStart=2;
 r=applyThrow(r,'s',...d(1.2,18));assert.equal(r.players[0].score,2);assert.equal(r.lastHit.bust,true);
});
test('réplique 26 sur 3 fléchettes',()=>{
 let r=trio();r=applyThrow(r,'s',0,1.2); // 20
 r=applyThrow(r,'s',...d(1.2,-18)); // simple 5
 r=applyThrow(r,'s',...d(1.2,18));
 assert.equal(r.lastHit.quip,'Hihihi 26 !');
 assert.equal(r.turn,1);
});
test('deux simples 1 : Atika',()=>{
 let r=trio();r=applyThrow(r,'s',...d(1.2,18));r=applyThrow(r,'s',...d(1.2,18));
 assert.equal(r.lastHit.quip,'Atika, roi des uns !');
});
test('triple 1 : Triple buse',()=>{
 let r=trio();r=applyThrow(r,'s',...d(1.03,18));assert.equal(r.lastHit.quip,'Triple buse !');
});
test('deux triples élevés : Chairman',()=>{
 let r=trio();r=applyThrow(r,'s',0,1.03);r=applyThrow(r,'s',0,1.03);
 assert.equal(r.lastHit.quip,'I’m a Chairman !');
});
