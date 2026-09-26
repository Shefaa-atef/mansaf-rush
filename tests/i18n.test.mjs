import assert from 'node:assert/strict';
import {test} from 'node:test';
import {TRANSLATIONS,feedbackText} from '../src/i18n.ts';

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

test('the four players carry the chosen names, in seat order',()=>{
 assert.deepEqual(en.names,['You','Suhaib','Ameen','Mefleh']);
 assert.deepEqual(ar.names,['أنت','صهيب','أمين','مفلح']);
});

test('the desktop roll explanation says what to press, how it counts and when to stop',()=>{
 const step=1;
 const e=en.intro.steps[step].desc, a=ar.intro.steps[step].desc;
 for(const part of ['SPACE','←','→','↑','gauge','green','squashed'])assert.ok(e.includes(part),`English roll text should mention ${part}: ${e}`);
 for(const part of ['المسافة','بالتبادل','أخضر','بتنعجن'])assert.ok(a.includes(part),`Arabic roll text should mention ${part}: ${a}`);
 assert.ok(!/no need to hold/i.test(e),'the old "no need to hold SPACE" wording is gone');
 assert.ok(a.length<400&&e.length<400,'short enough to fit the card');
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

test('the phone guide has a line for every stage of the bite, in both languages',()=>{
 const stages=['move','scooping','enough','full','topup','rolling','ready','eating','dry'];
 for(const [lang,t] of [['en',en],['ar',ar]]){
  for(const stage of stages){
   const hint=typeof t.touch.hint[stage]==='function'?t.touch.hint[stage](2,6):t.touch.hint[stage];
   assert.ok(String(hint).trim().length>0,`${lang}.touch.hint.${stage} is missing`);
  }
  assert.equal(t.touch.steps.length,3,`${lang} guide needs three steps`);
 }
 assert.deepEqual(ar.touch.steps,['جمّع','دحبر','كُل'],'the Arabic steps use the same words as the rest of the game');
});

test('moving from gathering to rolling is announced as "gathering done" so it cannot be missed',()=>{
 assert.ok(en.touch.hint.rolling(0,6).includes('Gathering done'));
 assert.ok(ar.touch.hint.rolling(0,6).includes('التجميع'));
 assert.ok(en.touch.hint.enough.toLowerCase().includes('enough'),'the moment there is enough rice has its own line');
 assert.ok(ar.touch.hint.enough.includes('كفاية'));
 assert.ok(en.touch.hint.enough.includes('Let go')&&ar.touch.hint.enough.includes('فلّت'),'and says what to do about it');
});

test('phone text never tells the player to press keys a phone does not have',()=>{
 const KEY_WORDS=/SPACE|space|[←→↑↓]|المسافة|الأسهم|بالأسهم/;
 for(const [lang,t] of [['en',en],['ar',ar]]){
  const texts=[...Object.entries(flatten(t.touch)),...Object.entries(flatten(t.feedbackTouch))];
  for(const [k,v] of texts)assert.ok(!KEY_WORDS.test(String(v)),`${lang}.${k} mentions a key: ${v}`);
 }
 // The joystick is the name players know it by, in both languages.
 assert.ok(en.touch.hint.move.toLowerCase().includes('joystick'));
 assert.ok(ar.touch.hint.move.includes('الجويستك'));
});

test('feedbackText swaps in the phone wording only for touch layouts',()=>{
 for(const lang of ['en','ar']){
  const t=TRANSLATIONS[lang];
  assert.equal(feedbackText(lang,false).roundLokma,t.feedback.roundLokma);
  assert.equal(feedbackText(lang,true).roundLokma,t.feedbackTouch.roundLokma);
  assert.equal(feedbackText(lang,true).alternateHint,t.feedbackTouch.alternateHint);
  assert.equal(feedbackText(lang,true).finishRolling,t.feedbackTouch.finishRolling);
  assert.equal(feedbackText(lang,true).perfect,t.feedback.perfect,'messages without a phone version carry over');
  assert.equal(feedbackText(lang,true).overRolled,t.feedback.overRolled);
 }
});
