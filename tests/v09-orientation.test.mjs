import test from 'node:test';
import assert from 'node:assert/strict';
import {flightPose} from '../flight-path.mjs';

const deg = d => d * 180 / Math.PI;
const cases = [
  {a:[165,610,165,145,142,1],name:'vertical'},
  {a:[85,610,310,185,142,1],name:'diagonale droite'},
  {a:[350,610,105,155,142,-1],name:'diagonale gauche'},
  {a:[160,650,260,90,135,-1],name:'cible haute'},
  {a:[190,550,250,315,135,1],name:'cible basse'}
];
for (const {a,name} of cases) test(`Orientation stable : ${name}`, () => {
 const [fx,fy,tx,ty,r,side] = a;
 const poses=Array.from({length:101},(_,i)=>flightPose(fx,fy,tx,ty,i/100,r,side));
 assert.ok(Math.abs(poses[0].x-fx)<1e-8 && Math.abs(poses[0].y-fy)<1e-8);
 assert.ok(Math.abs(poses[100].x-tx)<1e-8 && Math.abs(poses[100].y-ty)<1e-8);
 for(let i=1;i<poses.length;i++){
   assert.ok(Math.abs(deg(poses[i].angle-poses[i-1].angle)) < 1, 'Rotation brutale au pas '+i);
 }
 const end=poses[100], near=poses[99];
 assert.ok(Math.abs(deg(end.angle-near.angle))<.5,'Rotation brusque à l’impact');
 const start=poses[0];
 assert.ok(Math.abs(deg(end.angle-start.angle))<1e-7,'L’axe de vol reste cohérent');
});
test('La fléchette plantée reprend l’angle de son dernier instant en vol',async()=>{
 const {readFileSync}=await import('node:fs');
 const app=readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
 assert.match(app,/angle:pose\.angle/);
 assert.match(app,/dart\.angle\?\?-Math\.PI\/2/);
 assert.match(app,/const scale=\.85-\.50\*q/);
 assert.doesNotMatch(app,/drawCompetitionDart\(ctx,p\.x,p\.y,-2\.36/);
});
