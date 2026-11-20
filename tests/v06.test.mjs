import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRoom,addPlayer,beginGame,applyThrow,targetFromFlick} from '../rules.mjs';
function lobby(n){let r=makeRoom('s','Stéphane','stephane',301,true,n);if(n>1)r=addPlayer(r,'f','Franck','franck');if(n>2)r=addPlayer(r,'m','Mathias','mathias');if(n>3)r=addPlayer(r,'i','Invité','invite');return r;}
test('le choix du nombre de joueurs est enregistré',()=>{for(const n of [1,2,3,4])assert.equal(lobby(n).maxPlayers,n);});
test('une salle à 2 est jouable dès le deuxième participant',()=>{const r=beginGame(lobby(2),'s');assert.equal(r.status,'playing');assert.equal(r.players.length,2);});
test('une salle à 4 attend bien le quatrième joueur',()=>{let r=lobby(3);r.maxPlayers=4;assert.throws(()=>beginGame(r,'s'));r=addPlayer(r,'i','Invité','invite');assert.equal(beginGame(r,'s').players.length,4);});
test('pas de cinquième joueur',()=>assert.throws(()=>addPlayer(lobby(4),'x','X','invite')));
test('un lancer garde la même règle avec 4 joueurs',()=>{let r=beginGame(lobby(4),'s');for(let i=0;i<12;i++){const j=r.turn;r=applyThrow(r,r.players[j].uid,2,2);}assert.equal(r.turn,0);});
test('un flick plus rapide frappe plus haut',()=>{
 const slow=targetFromFlick([{x:100,y:310,t:0},{x:100,y:130,t:400}],0,600);
 const fast=targetFromFlick([{x:100,y:310,t:0},{x:100,y:130,t:150}],0,600);
 assert.ok(fast.y>slow.y);
});
test('le mouvement terminal vers la droite provoque une dérive',()=>{
 const v=targetFromFlick([{x:100,y:320,t:0},{x:100,y:260,t:80},{x:145,y:150,t:160}],0.5,600);
 assert.ok(v.x>.5);
});
test('geste parfaitement vertical : conserve le placement initial',()=>{
 const t=targetFromFlick([{x:80,y:290,t:0},{x:80,y:120,t:130}],.9,600);
 assert.equal(t.x,.9);
});
