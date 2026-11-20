// Choix déterministe pour que tous les téléphones affichent la même réaction.
export function opponentReaction(hit,players=[],localAvatar='stephane'){
  if(!hit)return null;
  const participants=players.filter(p=>p.uid!==hit.uid);
  const characters=[{uid:'_franck',name:'Franck',avatar:'franck'},{uid:'_stephane',name:'Stéphane',avatar:'stephane'},{uid:'_mathias',name:'Mathias',avatar:'mathias'}];
  const candidates=participants.length?participants:characters.filter(c=>c.avatar!==localAvatar);
  if(!candidates.length)return null;
  const speaker=candidates[Math.abs(Number(hit.seq||1))%candidates.length];
  let text=hit.quip||'',mood='taunt';
  if(hit.won){text='Alors là, bravo !';mood='cheer';}
  else if(hit.kind==='triple'&&hit.number===20&&hit.turnTotal===180){text='CENT QUATRE-VINGTS ! Tocar !';mood='cheer';}
  else if(hit.kind==='triple'&&hit.number===20){text='Tocar !';mood='cheer';}
  else if(hit.bust){text='Oh non, bust !';mood='groan';}
  else if(hit.kind==='miss'){text='Miskine !';mood='taunt';}
  else if(hit.turnTotal===26&&hit.dartNumber===3){text='Hihihi, 26 !';mood='laugh';}
  else if(hit.points>=54){text='Quel joli lancer !';mood='cheer';}
  if(!text)return null;
  if(/atika|hihihi/i.test(text))mood='laugh';
  return {name:speaker.name,avatar:speaker.avatar,text,mood};
}
export function teaseReaction(reaction,players=[]){
  if(!reaction)return null;
  const target=players.find(p=>p.uid===reaction.target);
  return {name:target?.name||'Un copain',avatar:target?.avatar||'invite',text:'Tocar !',mood:'taunt'};
}
