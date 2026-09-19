import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { botSeats } from './platterFood';
import type { Game } from './main';
import type { Lang } from './i18n';

// 'missed' always shows (useful feedback). The eat* keys are a pool of
// table-talk lines a bot can say after a good bite - one is picked at
// random, and only shown some of the time (see EAT_SHOW_CHANCE below),
// so it doesn't fire on every single lokma.
type Key='missed'|'eat0'|'eat1'|'eat2'|'eat3'|'eat4';
const EAT_KEYS:Key[]=['eat0','eat1','eat2','eat3','eat4'];
const EAT_SHOW_CHANCE=0.35;
const copy:Record<Lang,Record<Key,string>>={
  en:{
    missed:'MISSED!',
    eat0:'😋 So tasty!',
    eat1:'🥣 Real karaki jameed!',
    eat2:'🤲 Bismillah',
    eat3:'✨ Alhamdulillah',
    eat4:'💛 Bless mom’s hands!',
  },
  ar:{
    missed:'أخطأ!',
    eat0:'😋 الأكل زاكي',
    eat1:'🥣 جميد كركي أصلي',
    eat2:'🤲 بسم الله',
    eat3:'✨ الحمدلله',
    eat4:'💛 يسلمو ايدين الوالدة',
  },
};
function badge(key:Key,text:string,lang:Lang){
  const isMiss=key==='missed';
  const W=560,H=228,bodyX=28,bodyY=20,bodyW=W-bodyX*2,bodyH=138,radius=46;
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d')!;
  ctx.direction=lang==='ar'?'rtl':'ltr';
  const tailCx=W/2,tailY=bodyY+bodyH;
  // body + soft drop shadow
  ctx.save();ctx.shadowColor='#00000066';ctx.shadowBlur=20;ctx.shadowOffsetY=7;
  const grad=ctx.createLinearGradient(0,bodyY,0,bodyY+bodyH);
  if(isMiss){grad.addColorStop(0,'#ff6f5c');grad.addColorStop(1,'#c0392b');}
  else{grad.addColorStop(0,'#ffe9ab');grad.addColorStop(1,'#e0a94a');}
  ctx.fillStyle=grad;
  ctx.beginPath();ctx.roundRect(bodyX,bodyY,bodyW,bodyH,radius);ctx.fill();
  ctx.beginPath();ctx.moveTo(tailCx-22,tailY-6);ctx.lineTo(tailCx+22,tailY-6);ctx.lineTo(tailCx,tailY+32);ctx.closePath();ctx.fill();
  ctx.restore();
  // outline (skip the seam where the tail meets the body)
  ctx.lineWidth=7;ctx.strokeStyle=isMiss?'#ffdccf':'#fff3d6';
  ctx.beginPath();ctx.roundRect(bodyX,bodyY,bodyW,bodyH,radius);ctx.stroke();
  ctx.beginPath();ctx.moveTo(tailCx-22,tailY-6);ctx.lineTo(tailCx,tailY+32);ctx.lineTo(tailCx+22,tailY-6);ctx.stroke();
  // text, auto-shrunk to fit the bubble
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=isMiss?'#fff7f0':'#3b2313';
  const maxTextW=bodyW-72;let size=lang==='ar'?48:40;
  ctx.font=`800 ${size}px Changa, Nunito, Arial`;
  while(ctx.measureText(text).width>maxTextW&&size>22){size-=2;ctx.font=`800 ${size}px Changa, Nunito, Arial`;}
  ctx.fillText(text,W/2,bodyY+bodyH/2+3);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;return map;
}
// A bubble pops up above a bot's head after their bite resolves. Misses
// always get called out; good bites only get a line some of the time
// (EAT_SHOW_CHANCE) picked at random from the table-talk pool, so heads
// aren't chattering after every single lokma.
function OpponentBadge({id,game,maps}:{id:number;game:RefObject<Game>;maps:Map<Key,THREE.Texture>}){
  const sprite=useRef<THREE.Sprite>(null),lastResultAt=useRef(0),shownAt=useRef(-Infinity),activeKey=useRef<Key|undefined>(undefined),phraseKey=useRef<Key>(EAT_KEYS[0]);
  const [x,z]=botSeats[id-1],baseY=id===2?1.82:2.15;
  const WINDOW=4200; // total on-screen lifetime; quick pop-in, long hold, quick fade - see enter/exit below
  useFrame(()=>{if(!sprite.current)return;const g=game.current,now=performance.now();
    const result=g.botResults?.[id-1];
    // Each bot resolves a bite every few seconds regardless of whether we
    // choose to display anything for it. We only reset the on-screen timer
    // (shownAt) when we actually decide to show a bubble, so a badge that's
    // already up always gets its full WINDOW instead of being silently cut
    // short the instant the next bite resolves behind it.
    if(result&&result.at!==lastResultAt.current){
      lastResultAt.current=result.at;
      const missed=result.taken<=0;
      const show=missed||Math.random()<EAT_SHOW_CHANCE;
      if(show){
        if(missed)activeKey.current='missed';
        else{
          let next=EAT_KEYS[Math.floor(Math.random()*EAT_KEYS.length)];
          if(next===phraseKey.current)next=EAT_KEYS[(EAT_KEYS.indexOf(next)+1)%EAT_KEYS.length];
          phraseKey.current=next;activeKey.current=next;
        }
        shownAt.current=now;
      }
    }
    const age=now-shownAt.current;
    let key:Key|undefined,phase=0;
    if(g.phase==='playing'&&activeKey.current&&age<WINDOW){key=activeKey.current;phase=age/WINDOW;}
    const map=key?maps.get(key):undefined;sprite.current.visible=!!map;if(!map)return;
    const material=sprite.current.material as THREE.SpriteMaterial;if(material.map!==map){material.map=map;material.needsUpdate=true}
    const enter=THREE.MathUtils.smootherstep(phase,0,.08),exit=1-THREE.MathUtils.smootherstep(phase,.88,1),pop=enter*exit;
    sprite.current.scale.set(.96*pop,.39*pop,1);sprite.current.position.y=baseY+Math.sin(Math.min(1,phase)*Math.PI)*.045;
  });
  // frustumCulled must be off: the sprite starts at scale 0 for its pop-in
  // animation, and Three.js can bake that zero-size bounding sphere in and
  // then wrongly keep culling the sprite even once its scale grows back up,
  // which reads as "the badge never shows" even though everything else -
  // the bite resolving, the texture, visible/scale updates - is correct.
  return <sprite ref={sprite} position={[x+(id===1 ? -.42 : id===3 ? .42 : .62),baseY,z+.02]} visible={false} renderOrder={20} frustumCulled={false}><spriteMaterial transparent depthTest={false} depthWrite={false}/></sprite>;
}
export function OpponentEffects({game,lang}:{game:RefObject<Game>;lang:Lang}){
  const maps=useMemo(()=>new Map<Key,THREE.Texture>((Object.keys(copy[lang]) as Key[]).map(key=>[key,badge(key,copy[lang][key],lang)])),[lang]);
  useEffect(()=>()=>maps.forEach(map=>map.dispose()),[maps]);
  return <group name="opponent-action-effects">{[1,2,3].map(id=><OpponentBadge key={id} id={id} game={game} maps={maps}/>)}</group>;
}
