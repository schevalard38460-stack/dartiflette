import test from 'node:test';
import assert from 'node:assert/strict';
import {flightPose} from '../flight-path.mjs';
import {DART_STYLES,dartAppearanceFor} from '../dart-render.mjs';
import {opponentReaction,teaseReaction} from '../reactions.mjs';
import {makeRoom,applyThrow} from '../rules.mjs';
import {SFX} from '../audio.mjs';

test('Courbe du vol: origine, arrivée précise, déviation visible et angle orienté',()=>{
  const a=flightPose(145,620,165,180,0,130,1);
  const b=flightPose(145,620,165,180,1,130,1);
  const mid=flightPose(145,620,165,180,.5,130,1);
  assert.ok(Math.abs(a.x-145)<1e-9&&Math.abs(a.y-620)<1e-9);
  assert.ok(Math.abs(b.x-165)<1e-9&&Math.abs(b.y-180)<1e-9);
  assert.ok(mid.y<400); // courbure plus forte qu'une simple ligne droite
  assert.ok(Number.isFinite(mid.angle));
  const opposite=flightPose(145,620,165,180,.5,130,-1);
  assert.ok(Math.abs(opposite.x-mid.x)>10);
});
test('Les trois amis ont des modèles de fléchettes de compétition différents',()=>{
  assert.notEqual(DART_STYLES.franck.flight,DART_STYLES.mathias.flight);
  assert.notEqual(DART_STYLES.stephane.flight,DART_STYLES.franck.flight);
  assert.equal(dartAppearanceFor([{uid:'p',avatar:'mathias'}],'p'),'mathias');
});
test('Un triple 20 déclenche Tocar de la part d’un adversaire, pas du lanceur',()=>{
  const players=[{uid:'1',avatar:'franck',name:'Franck'},{uid:'2',avatar:'mathias',name:'Mathias'},{uid:'3',avatar:'stephane',name:'Stéphane'}];
  const result=opponentReaction({seq:3,uid:'1',kind:'triple',number:20,points:60,quip:'Tocar !'},players);
  assert.equal(result.text,'Tocar !');assert.notEqual(result.avatar,'franck');
  assert.equal(teaseReaction({target:'2'},players).avatar,'mathias');
});
test('En solo, le commentaire vient d’un autre personnage',()=>{
  const h={seq:1,uid:'solo',kind:'miss',points:0};
  const reaction=opponentReaction(h,[{uid:'solo',avatar:'stephane',name:'Stéphane'}],'stephane');
  assert.equal(reaction.text,'Miskine !');assert.notEqual(reaction.avatar,'stephane');
});
test('Les clips de lancement, vol, impact et réactions sont référencés',()=>{
  for(const n of ['release','flight','impact','big_hit','miss','cheer','groan','tocar'])assert.ok(SFX.includes(n));
});
test('Le rendu sonore et la courbe ne changent pas les scores',()=>{
  let room={...makeRoom('u','Franck','franck',301,true,1),status:'playing'};
  room=applyThrow(room,'u',0,1.03);
  assert.equal(room.players[0].score,241);
  const hit=room.lastHit;
  flightPose(100,600,140,150,.7);
  opponentReaction(hit,room.players,'franck');
  assert.equal(room.players[0].score,241);
});
