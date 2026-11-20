// Courbe cubique en perspective; aucune influence sur les points ou la précision.
export function flightPose(fromX,fromY,toX,toY,t,boardRadius=140,side=1){
  const q=Math.max(0,Math.min(1,t)),a=1-q;
  const dx=toX-fromX,dy=toY-fromY;
  const bend=Math.min(49,boardRadius*.33)*Math.sign(side||1);
  // Sortie de main légèrement déviée, trajectoire arquée, retombée en cible.
  const p1={x:fromX+dx*.22+bend*.55,y:fromY+dy*.19-boardRadius*.06};
  const p2={x:toX-dx*.20+bend*.60,y:toY-boardRadius*.33};
  const x=a*a*a*fromX+3*a*a*q*p1.x+3*a*q*q*p2.x+q*q*q*toX;
  const y=a*a*a*fromY+3*a*a*q*p1.y+3*a*q*q*p2.y+q*q*q*toY;
  const tx=3*a*a*(p1.x-fromX)+6*a*q*(p2.x-p1.x)+3*q*q*(toX-p2.x);
  const ty=3*a*a*(p1.y-fromY)+6*a*q*(p2.y-p1.y)+3*q*q*(toY-p2.y);
  // A frontal 2D projection of a real dart: orientation must remain close to
  // the actual launch-to-target axis, not the tangent of a decorative curve.
  // The old tangent angle could flip > 100 degrees near the last frame, because
  // control point p2 is above the target and the projected path falls at the end.
  // A subtle continuous bank keeps the motion readable; the bank returns to
  // zero on impact, so the arrival and embedded dart share EXACTLY the angle.
  const directAngle=Math.atan2(dy,dx);
  const bank=Math.sin(Math.PI*q)*0.115*Math.sign(side||1);
  const attitude=Math.sin(Math.PI*q)*0.045*Math.sin(directAngle);
  const angle=directAngle+bank+attitude;
  return {x,y,angle,tangentX:tx,tangentY:ty};
}
