import test from 'node:test';
import assert from 'node:assert/strict';
import {shotShow,progressFlight,launchAreaStart} from '../show.mjs';
import {makeRoom,applyThrow} from '../rules.mjs';

test('zone de lancer agrandie : plus de 40 % de hauteur utile',()=>{
  assert.ok(1-launchAreaStart(600)/600>.45);
});
test('le trajet respecte 0 et 1 et ralentit avant la cible',()=>{
  for(const slow of [false,true]){
    assert.equal(progressFlight(-2,slow),0);
    assert.equal(progressFlight(2,slow),1);
    let previous=0;
    for(let i=1;i<=100;i++){
      const q=progressFlight(i/100,slow);
      assert.ok(q>=previous-1e-8);previous=q;
    }
  }
  assert.ok(progressFlight(.5,true)>progressFlight(.5,false));
});
test('tirs spéciaux : triple 20, 180, bull et checkout plus longs que le tir ordinaire',()=>{
  const ordinary=shotShow({kind:'single',number:5,points:5}).duration;
  for(const hit of [
    {kind:'triple',number:20,points:60},
    {kind:'triple',number:20,points:60,turnTotal:180},
    {kind:'bull',number:50,points:50},
    {kind:'double',number:20,points:40,won:true}
  ]) assert.ok(shotShow(hit).duration>ordinary);
  assert.equal(shotShow({kind:'double',number:20,points:40,won:true}).kind,'win');
  assert.equal(shotShow({kind:'triple',number:20,points:60,turnTotal:180}).title,'180 !');
});
test('180 : le dernier résultat conserve le total des 3 fléchettes',()=>{
  let room={...makeRoom('s','Stéphane','stephane',301,true,1),status:'playing'};
  for(let i=0;i<3;i++)room=applyThrow(room,'s',0,1.03);
  assert.equal(room.lastHit.turnTotal,180);
  assert.equal(room.players[0].score,121);
  assert.equal(shotShow(room.lastHit).kind,'perfect');
});
test('le show ne change pas le score d’un tir ordinaire',()=>{
  let room={...makeRoom('s','Stéphane','stephane',301,true,1),status:'playing'};
  room=applyThrow(room,'s',0,1.03);
  const before=room.players[0].score;
  shotShow(room.lastHit);progressFlight(.7,true);
  assert.equal(room.players[0].score,before);
});
