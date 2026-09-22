import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createDealer} from '../src/phraseDealer.ts';

// Small seeded generator so the shuffles are reproducible.
const seeded=seed=>()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);

test('every line is used once before any line repeats',()=>{
 const size=27,d=createDealer(size,seeded(7));
 for(let deck=0;deck<5;deck++){
  const seen=new Set();
  for(let i=0;i<size;i++)seen.add(d.next());
  assert.equal(seen.size,size,`deck ${deck} repeated a line`);
 }
});

test('a fresh shuffle never opens with the line that just ended the last one',()=>{
 for(let seed=1;seed<=300;seed++){
  const size=4,d=createDealer(size,seeded(seed));
  let last=d.next();
  for(let i=1;i<size*8;i++){const next=d.next();assert.notEqual(next,last,`seed ${seed}, draw ${i}`);last=next;}
 }
});

test('the order really is shuffled, not just 0,1,2...',()=>{
 const d=createDealer(27,seeded(3)),first=Array.from({length:27},()=>d.next());
 assert.notDeepEqual(first,[...first].sort((a,b)=>a-b));
});

test('a pool of one line still works',()=>{
 const d=createDealer(1);
 assert.deepEqual([d.next(),d.next(),d.next()],[0,0,0]);
});
