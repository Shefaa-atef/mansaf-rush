import assert from 'node:assert/strict';
import {test} from 'node:test';
import {formatNumber,roundTo2} from '../src/formatNumber.ts';

test('numbers show at most two decimals and drop trailing zeros',()=>{
 assert.equal(formatNumber(87.63999999999999),'87.64');
 assert.equal(formatNumber(0.30000000000000004),'0.3');
 assert.equal(formatNumber(2.345),'2.35');
 assert.equal(formatNumber(3.5),'3.5');
 assert.equal(formatNumber(12),'12');
 assert.equal(formatNumber(99.999),'100');
});

test('tiny, negative-zero and non-finite values never leak odd text',()=>{
 assert.equal(formatNumber(1e-9),'0');
 assert.equal(formatNumber(-0.001),'0');
 assert.equal(formatNumber(NaN),'0');
 assert.equal(formatNumber(Infinity),'0');
 assert.equal(Object.is(roundTo2(-0.001),0),true);
});

test('roundTo2 keeps ranking ties consistent with what is displayed',()=>{
 assert.equal(roundTo2(10.001),roundTo2(10.004));
 assert.notEqual(roundTo2(10.004),roundTo2(10.016));
});
