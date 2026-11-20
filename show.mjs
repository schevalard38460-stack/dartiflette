// Effets visuels locaux : aucun changement aux règles de score ou à Firebase.
export function shotShow(hit) {
  if (!hit) return {kind:'normal',duration:850,title:'',slow:false};
  if (hit.won) return {kind:'win',duration:2350,title:'VICTOIRE !',slow:true};
  if (hit.kind==='triple' && hit.number===20 && hit.turnTotal===180) return {kind:'perfect',duration:2100,title:'180 !',slow:true};
  if (hit.kind==='triple' && hit.number===20) return {kind:'great',duration:1450,title:'TRIPLE 20 !',slow:true};
  if (hit.dartNumber===3 && hit.turnTotal>=100)
    return {kind:'great',duration:1620,title:'SUPERBE VOLÉE !',slow:true};
  if ((hit.kind==='triple' && hit.number>=17) || (hit.points>=50 && hit.kind==='bull'))
    return {kind:'great',duration:1320,title:hit.label||'JOLI LANCER !',slow:true};
  if (hit.bust) return {kind:'bust',duration:1000,title:'BUST !',slow:false};
  return {kind:'normal',duration:850,title:'',slow:false};
}
export function progressFlight(fraction,slow=false) {
  const t=Math.max(0,Math.min(1,fraction));
  if (slow) {
    if (t<.38) return .76*(t/.38);
    const q=(t-.38)/.62;
    return .76+.24*(1-Math.pow(1-q,2.25));
  }
  return 1-Math.pow(1-t,1.8);
}
export function launchAreaStart(height) { return height*.535; }
