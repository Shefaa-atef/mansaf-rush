import assert from 'node:assert/strict';
import {test} from 'node:test';
import {freshLokma,roll,beginEating,lokmaScore} from '../src/lokma.ts';

test('forming requires a released mouse, SPACE, and alternating arrows',()=>{
 const l=freshLokma();l.amount=5;
 assert.equal(roll(l,'ArrowLeft',100),false);
 l.space=true;l.gathering=true;assert.equal(roll(l,'ArrowLeft',100),false);
 l.gathering=false;assert.equal(roll(l,'ArrowLeft',100),true);
 assert.equal(roll(l,'ArrowLeft',120),false);assert.equal(l.rolls,1);
 assert.equal(roll(l,'ArrowRight',150),true);
 assert.equal(roll(l,'KeyA',160),false);assert.equal(l.rolls,2);
});
test('loose eating starts a failed lift and can never score',()=>{
 const l=freshLokma();assert.equal(beginEating(l,100),false);
 l.amount=5;assert.equal(beginEating(l,100),true);assert.equal(l.failed,true);
 assert.equal(lokmaScore(l,700),0);assert.equal(beginEating(l,200),false);
});
test('formed bites lock input during transport; over-compression reduces size and score',()=>{
 const l=freshLokma();Object.assign(l,{amount:6,space:true,since:100});
 for(let i=0;i<4;i++)assert.equal(roll(l,i%2?'ArrowRight':'ArrowLeft',200+i*100),true);
 const good=lokmaScore(l,900),amount=l.amount;
 for(let i=4;i<9;i++)roll(l,i%2?'ArrowRight':'ArrowLeft',200+i*100);
 assert.ok(l.amount<amount);assert.ok(lokmaScore(l,1500)<good);
 assert.equal(beginEating(l,1600),true);l.space=true;
 assert.equal(roll(l,'ArrowRight',1700),false);
});
test('meat and speed bonuses are independent, and reset clears all held food',()=>{
 const l=freshLokma();Object.assign(l,{amount:5,rolls:4,since:100});
 const base=lokmaScore(l,6000);assert.equal(lokmaScore(l,1000),base+1);
 l.meat=true;assert.equal(lokmaScore(l,1000),base+2);
 const reset=freshLokma();assert.equal(reset.amount,0);assert.equal(reset.rolls,0);assert.equal(reset.eating,0);assert.equal(reset.meat,false);
});
