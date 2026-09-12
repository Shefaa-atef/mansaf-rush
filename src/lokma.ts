export type Lokma = {
 amount:number; bread:number; rolls:number; last:string; rollAt:number; space:boolean; gathering:boolean;
 meat:boolean; since:number; eating:number; failed:boolean; swallowed:boolean; spill:number; x:number; z:number;
};
export const freshLokma = ():Lokma => ({amount:0,bread:0,rolls:0,last:'',rollAt:0,space:false,gathering:false,meat:false,since:0,eating:0,failed:false,swallowed:false,spill:0,x:.4,z:1.2});
export function roll(l:Lokma,key:string,now=performance.now()) {
 if(!l.space || l.gathering || l.amount<=0 || l.eating || key===l.last || !['ArrowLeft','ArrowRight'].includes(key)) return false;
 l.last=key;l.rolls++;l.rollAt=now;
 if(l.rolls>6){const before=l.amount;l.amount=Math.max(.5,l.amount*.84);l.bread*=l.amount/before;l.spill=now;}
 return true;
}
export function beginEating(l:Lokma,now:number) {
 if(l.amount<=0||l.eating||l.gathering)return false;
 l.eating=now;l.failed=l.rolls<4;l.space=false;
 return true;
}
export function lokmaLabel(l:Lokma) {
 return l.eating?(l.failed?'Oops! Loose food is falling':'Bring it to the mouth'):l.gathering||!l.amount?'1 · Gather rice or shrak':l.rolls<4?'2 · Form the lokma':l.rolls<=6?'3 · Lokma ready — press ↑':'3 · Squashed lokma — press ↑';
}
export function lokmaScore(l:Lokma,now:number) {
 if(l.rolls<4||l.failed)return 0;
 const quality=l.rolls>6?Math.min(3,Math.round(l.amount*.5)):l.amount<3?3:l.amount<5?5:7;
 return Math.max(1,quality+(l.meat?1:0)+(now-l.since<4500&&l.rolls<=6&&l.amount>=3?1:0));
}
