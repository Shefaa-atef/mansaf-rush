import assert from 'node:assert/strict';
import {test} from 'node:test';
import {playWhenAllowed} from '../src/autoplayGate.ts';

const blocked=()=>Object.assign(new Error('play() failed because the user has not interacted'),{name:'NotAllowedError'});
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const fire=(target,name)=>target.dispatchEvent(new Event(name));

// An attempt that is refused until `allow()` is called, like a browser before the first gesture.
const gatedAttempt=()=>{
 let open=false,calls=0;
 return {
  attempt:()=>{calls++;return open?Promise.resolve():Promise.reject(blocked());},
  allow:()=>{open=true;},
  block:()=>{open=false;},
  get calls(){return calls;},
 };
};

test('plays straight away when the browser already allows it, and never waits for a gesture',async()=>{
 const target=new EventTarget(),gate=gatedAttempt();
 gate.allow();
 playWhenAllowed(gate.attempt,target);
 await settle();
 fire(target,'click');fire(target,'keydown');
 await settle();
 assert.equal(gate.calls,1);
});

test('when blocked, it waits and plays on the first click',async()=>{
 const target=new EventTarget(),gate=gatedAttempt();
 playWhenAllowed(gate.attempt,target);
 await settle();
 assert.equal(gate.calls,1,'tried once on load');
 gate.allow();
 fire(target,'click');
 await settle();
 assert.equal(gate.calls,2,'retried on the click');
 fire(target,'click');fire(target,'keydown');
 await settle();
 assert.equal(gate.calls,2,'stops retrying once it has played');
});

test('a key press counts as a gesture too',async()=>{
 const target=new EventTarget(),gate=gatedAttempt();
 playWhenAllowed(gate.attempt,target);
 await settle();
 gate.allow();
 fire(target,'keydown');
 await settle();
 assert.equal(gate.calls,2);
});

test('keeps waiting if the first gesture still was not enough (e.g. Escape)',async()=>{
 const target=new EventTarget(),gate=gatedAttempt();
 playWhenAllowed(gate.attempt,target);
 await settle();
 fire(target,'keydown'); // still refused
 await settle();
 assert.equal(gate.calls,2);
 gate.allow();
 fire(target,'click');
 await settle();
 assert.equal(gate.calls,3);
 fire(target,'click');
 await settle();
 assert.equal(gate.calls,3);
});

test('only "needs a gesture" refusals are retried',async()=>{
 const target=new EventTarget();
 let calls=0;
 playWhenAllowed(()=>{calls++;return Promise.reject(Object.assign(new Error('bad file'),{name:'NotSupportedError'}));},target);
 await settle();
 fire(target,'click');
 await settle();
 assert.equal(calls,1);
});

test('giving up before the gesture means it never plays',async()=>{
 const target=new EventTarget(),gate=gatedAttempt();
 const cancel=playWhenAllowed(gate.attempt,target);
 await settle();
 cancel();
 gate.allow();
 fire(target,'click');fire(target,'keydown');
 await settle();
 assert.equal(gate.calls,1);
});

test('giving up from inside an earlier click handler beats the gate\'s own listener',async()=>{
 // This is the "Start" button case: the app's onClick runs before the window
 // listener and cancels the pending welcome, so it must not play afterwards.
 const target=new EventTarget(),gate=gatedAttempt();
 let cancel;
 target.addEventListener('click',()=>cancel(),{once:true}); // registered first, like React's root
 cancel=playWhenAllowed(gate.attempt,target);
 await settle();
 gate.allow();
 fire(target,'click');
 await settle();
 assert.equal(gate.calls,1);
});

test('an attempt that throws, or returns nothing, is harmless',async()=>{
 const target=new EventTarget();
 assert.doesNotThrow(()=>playWhenAllowed(()=>{throw new Error('no audio here');},target));
 let calls=0;
 playWhenAllowed(()=>{calls++;},target); // old browsers: play() returns undefined
 await settle();
 fire(target,'click');
 await settle();
 assert.equal(calls,1);
});

test('does nothing (and does not throw) outside a browser',()=>{
 assert.equal(typeof playWhenAllowed(()=>{}),'function');
});
