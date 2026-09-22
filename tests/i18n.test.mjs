import assert from 'node:assert/strict';
import {test} from 'node:test';
import {TRANSLATIONS} from '../src/i18n.ts';

const {en,ar}=TRANSLATIONS;
const ARABIC=/[؀-ۿ]/;
// Strings that are legitimately the same as (or free of) Arabic script in the Arabic UI.
const NO_ARABIC_LETTERS_OK=new Set([
 'header.langBtn',            // the button that switches back to English reads "English"
]);

// Flatten to {path: value}, calling template functions with sample arguments.
function flatten(node,path='',out={}){
 if(typeof node==='function'){out[path]=node(1,3);return out;}
 if(Array.isArray(node)){node.forEach((v,i)=>flatten(v,`${path}[${i}]`,out));return out;}
 if(node&&typeof node==='object'){for(const k of Object.keys(node))flatten(node[k],path?`${path}.${k}`:k,out);return out;}
 out[path]=node;return out;
}
const flatEn=flatten(en),flatAr=flatten(ar);

test('English and Arabic define exactly the same text keys',()=>{
 assert.deepEqual(Object.keys(flatAr).sort(),Object.keys(flatEn).sort());
});

test('no translation is empty',()=>{
 for(const [k,v] of Object.entries({...flatEn}))assert.ok(String(v).trim().length>0,`en.${k} is empty`);
 for(const [k,v] of Object.entries({...flatAr}))assert.ok(String(v).trim().length>0,`ar.${k} is empty`);
});

test('the bots\' table-talk pools have no duplicate lines and plenty of variety',()=>{
 for(const [lang,t] of [['en',en],['ar',ar]])for(const kind of ['eat','missed']){
  const pool=t.opponent[kind];
  assert.equal(new Set(pool).size,pool.length,`${lang}.opponent.${kind} has a duplicate line`);
 }
 assert.ok(ar.opponent.eat.length>=20,'want at least 20 different things for the bots to say');
 assert.ok(ar.opponent.missed.length>=5);
});

test('the Jordanian slang lines that were asked for are in the Arabic pool',()=>{
 const has=phrase=>ar.opponent.eat.some(line=>line.includes(phrase));
 for(const phrase of ['دحبرها','لحمة روماني ولا بلدي','هاد لوز ولا صنوبر','شرّب شرّب'])assert.ok(has(phrase),`missing: ${phrase}`);
});

test('every Arabic string actually contains Arabic (nothing left in English)',()=>{
 const untranslated=Object.entries(flatAr).filter(([k,v])=>!ARABIC.test(String(v))&&!NO_ARABIC_LETTERS_OK.has(k)).map(([k,v])=>`${k}: ${JSON.stringify(v)}`);
 assert.deepEqual(untranslated,[]);
});

test('the gameplay text is Jordanian slang, not stiff textbook Arabic',()=>{
 // These were the offending lines: "squashed lokma" and "perfect lokma" in formal Arabic.
 const stiff=['مهروسة','مثالية','مثالي','لقمة دائرية'];
 for(const [k,v] of Object.entries(flatAr))for(const word of stiff)assert.ok(!String(v).includes(word),`ar.${k} still says ${word}: ${v}`);
 // Colloquial Jordanian markers that the feedback and HUD must be using instead.
 const gameplay=Object.entries(flatAr).filter(([k])=>/^(hud|meter|feedback|lokmaLabels)\./.test(k)).map(([,v])=>String(v)).join(' ');
 for(const word of ['دوس','دايرة','دحبر','عالأصول'])assert.ok(gameplay.includes(word),`expected Jordanian "${word}" in the gameplay text`);
});

test('the score toast names lamb and almonds so the extra points are visible',()=>{
 for(const [lang,t] of [['en',en],['ar',ar]]){
  assert.ok(t.feedback.lamb(3).includes('3'),`${lang}.feedback.lamb must show the points`);
  assert.ok(t.feedback.almond(2).includes('2'),`${lang}.feedback.almond must show the points`);
 }
});
