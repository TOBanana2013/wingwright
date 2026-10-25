const P=require('../src/physics.js');const REAL=require('../src/real.js');
const custom={trainer:{length:8.5,height:1.3,width:1.1,span:10,chord:1.5,incidence:3,power:120,fuel:100,material:'alu',shape:'rounded',tail:'medium'}};
let wins=0,n=0;const verbose=process.argv[2];
for(const seed of [3,7,11,19]) for(const [k,c] of Object.entries({...custom,...REAL})){const s=P.specs(c);const W=P.makeWorld(s,seed);
const f=P.newFlight(s,W);const dt=1/120;let err=0,cnt=0,maxTurn=0,minH=1e9;
while(!f.result&&f.t<1500){const v=Math.hypot(f.vx,f.vy);const g=P.guide(f,s);let pitch,roll=0;
 if(f.ground&&!f.flew){f.throttle=1;pitch=v>s.vLift?1:0;}
 else{
  const app = g.phase==='approach'||g.phase==='flare';
  if(!app && f.h>100) f.flaps=0; if(app && g.captured) f.flaps=1;
  const vT = app ? s.vStallF*1.3 : Math.max(s.vStall*1.35, Math.min(s.vMax*0.6, s.vStall*1.6));
  f.throttle = Math.max(0,Math.min(1, 0.4+(vT-v)*0.08)); if(f.ground) f.throttle=0;
  f.brake = (app && v>vT+8) || f.ground ? 1:0;
  pitch=Math.max(-1,Math.min(1,(g.want-g.gamma)*0.35));
  const lim = g.phase==='flare'? 5 : (f.h<40? 15: Math.min(30,s.maxBank));
  const bankCmd=Math.max(-lim,Math.min(lim,g.turn*1.5 + (g.captured? -g.cross*0.0 :0)));
  roll=Math.max(-1,Math.min(1,(bankCmd-f.phi)/8));
  if(!f.ground){err+=Math.abs(g.want-g.gamma);cnt++;}
 }
 P.stepFlight(f,s,{pitch,roll},dt);}
n++; if(f.result&&f.result.kind==='win')wins++;
const tg=W.target;
console.log(seed,k.padEnd(7),(f.result&&f.result.kind)||'timeout',(f.result&&f.result.why||'').slice(0,60),'t',f.t|0,'tgt',Math.round(Math.hypot(tg.e,tg.n)),'hdg',Math.round(tg.hdg/P.DEG),'rw',tg.num,W.runways.length);}
console.log('wins',wins,'/',n);
