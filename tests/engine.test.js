const fs=require('fs'),path=require('path');
// usage: node tests/engine.test.js [path/to/engine.js]
const file=process.argv[2]||path.join(__dirname,'..','public','js','engine.js');
const src=fs.readFileSync(file,'utf8');
const m=[null,src];
const api=new Function(m[1]+';return {KEY,compose,decomp,JAMO2KEY,LESSONS,speedPool,newKeys,VOW,VCOMB,TAIL,TCOMB,PLACE,PLACE_PASSED_ALL,PLEVELS,KSETS,KEYORDER,ROWS,locDesc,masteryOf,buildPrompts,promptCount}')();
const {KEY,compose,decomp,JAMO2KEY,LESSONS,speedPool,newKeys,VOW,VCOMB,TAIL,TCOMB,PLACE,PLACE_PASSED_ALL,PLEVELS,KSETS,KEYORDER,ROWS,locDesc,masteryOf,buildPrompts,promptCount}=api;
let fail=0;const bad=(...a)=>{fail++;console.log('FAIL',...a)};
const hasCompoundV=w=>[...w].some(ch=>{const c=ch.charCodeAt(0)-0xAC00;return c>=0&&Object.values(VCOMB).includes(VOW[Math.floor((c%588)/28)])});
const hasDoubleT=w=>[...w].some(ch=>{const c=ch.charCodeAt(0)-0xAC00;return c>=0&&Object.values(TCOMB).includes(TAIL[c%28])});
const groups={};
if(LESSONS.length!==Object.keys(LESSONS).length||LESSONS.some(l=>!l||!l.id))bad('holes in LESSONS (stray comma?)');
if(new Set(LESSONS.map(l=>l.id)).size!==LESSONS.length)bad('duplicate lesson ids');
LESSONS.forEach((L,i)=>{
  if(L.items.length<10)bad('need >=10 items',L.id,L.items.length);
  const seen=new Set();
  L.items.forEach(it=>{
    const [kr,rom,mean,emo]=it;
    if(it.length!==4||!rom||!mean||!emo)bad('item fields',L.id,kr);
    if(seen.has(kr))bad('dup',L.id,kr);seen.add(kr);
    const j=decomp(kr);
    if(compose(j)!==kr)bad('roundtrip',L.id,kr,compose(j));
    j.forEach(x=>{if(!JAMO2KEY[x])bad('untypable',x,'in',kr)});
    for(let n=1;n<=j.length;n++)compose(j.slice(0,n));       // every prefix must compose
    if(i<8){                                                 // "Everyday words": gentle on purpose
      j.forEach(x=>{if(JAMO2KEY[x].shift)bad('shift key in easy pack',L.id,kr)});
      if(hasCompoundV(kr))bad('compound vowel in easy pack',L.id,kr);
      if(hasDoubleT(kr))bad('double final in easy pack',L.id,kr);
      if(kr.includes(' '))bad('space in easy pack',kr);
    }
    if(L.id==='shift'&&!j.some(x=>JAMO2KEY[x].shift))bad('shift pack word without shift',kr);
    if(L.id==='compound'&&!hasCompoundV(kr))bad('no compound vowel',kr);
    if(L.id==='double'&&!hasDoubleT(kr))bad('no double final',kr);
    if(L.id==='phrases'&&!kr.includes(' '))bad('phrase without space',kr);
    if((L.group==='Sentence Studio'||L.group==='Master Class')){
      if(kr.split(' ').length<2)bad('sentence needs 2+ words',kr);
      if(/[A-Za-z.,?!]/.test(kr))bad('untypable char',kr);
      if(L.items.length<10)bad('sentence pack small',L.id);
    }
  });
});
// advanced packs must get progressively longer on average
const adv=LESSONS.filter(l=>l.group==='Sentence Studio'||l.group==='Master Class');
if(adv.length<11)bad('want >=11 sentence packs',adv.length);
const avg=l=>l.items.reduce((a,w)=>a+decomp(w[0]).length,0)/l.items.length;
for(let i=1;i<adv.length;i++)if(avg(adv[i])<=avg(adv[i-1]))bad('sentence packs not getting longer',adv[i].id,avg(adv[i]),avg(adv[i-1]));
// placement bands: each typable, round-trips, and tests exactly the skill its name says
const feat=kr=>({shift:decomp(kr).some(x=>JAMO2KEY[x].shift),comp:hasCompoundV(kr),dbl:hasDoubleT(kr),sp:kr.includes(' ')});
PLACE.forEach((b,bi)=>{
  if(b.words.length!==2)bad('band needs 2 words',b.name);
  if(b.start<0||b.start>=LESSONS.length)bad('band start out of range',b.name);
  if(bi&&b.start<=PLACE[bi-1].start)bad('band starts must increase',b.name);
  b.words.forEach(w=>{const j=decomp(w[0]);if(compose(j)!==w[0])bad('placement roundtrip',w[0]);j.forEach(x=>{if(!JAMO2KEY[x])bad('placement untypable',w[0])});
    const f=feat(w[0]);
    if(bi<2&&(f.shift||f.comp||f.dbl||f.sp))bad('band',bi,'should be plain keys',w[0]);
    if(bi===2&&!f.shift)bad('shift band',w[0]);
    if(bi===3&&!f.comp)bad('compound band',w[0]);
    if(bi===4&&!f.dbl)bad('double band',w[0]);
    if(bi>=5&&!f.sp)bad('phrase band needs space',w[0]);
    if(bi===6&&w[0].split(' ').length<4)bad('sentence band too short',w[0]);
  });
});
if(PLEVELS.length!==PLACE.length+1)bad('levels count');
if(PLACE_PASSED_ALL>=LESSONS.length)bad('passed-all lesson index');
['easy','hard','sent'].forEach(lv=>{if(speedPool(lv).length<30)bad('pool small',lv)});
// every key gets introduced somewhere, and shift keys only appear in power-ups onward
const introduced=new Set();LESSONS.forEach((_,i)=>newKeys(i).forEach(k=>introduced.add(k)));
Object.values(KEY).flat().forEach(k=>{if(!introduced.has(k))bad('key never used by any pack',k)});
const nk8=[...new Set(LESSONS.slice(0,8).flatMap((_,i)=>newKeys(i)))];
if(nk8.some(k=>JAMO2KEY[k].shift))bad('shift key introduced early');

// IME-behaviour spot checks
const T=(s,exp)=>{const got=compose([...s]);if(got!==exp)bad('stream',s,'expected',exp,'got',got)};
T('ㅎㅏㄴ','한');T('ㅎㅏㄴㄱ','한ㄱ');T('ㅎㅏㄴㄱㅡㄹ','한글');T('ㄱㅗㅏ','과');T('ㄱㅜㅣ','귀');T('ㅇㅡㅣ','의');
T('ㅇㅣㄹㄱㅇㅓㅇㅛ','읽어요');T('ㄷㅏㄹㄱㅣ','달기');T('ㄷㅏㄹㄱㅇㅣ','닭이');T('ㄷㅏㄹㄱ','닭');T('ㅇㅏㄴㅈㅏ','안자');T('ㅇㅓㅂㅅㅇㅓ','없어');
T('ㅇㅓㅁㅁㅏ','엄마');T('ㄷㅏㄹㄱㄱㅗㄱㅣ','닭고기');T('ㅁㅜㄹ ㅈㅜㅅㅔㅇㅛ','물 주세요');T('ㅎㅏㄴ ㅈㅏㄴ','한 잔');
T('ㄷㅡㅇ','등');T('ㅇㅏㄴㄴㅕㅇ','안녕');T('ㄸㅓㄱㅂㅗㄲㅇㅣ','떡볶이');T('ㅁㅏㅅㅇㅣㅆㅇㅓㅇㅛ','맛있어요');T('ㅏ','ㅏ');T('ㄷ','ㄷ');
if(JAMO2KEY[' '].code!=='Space')bad('space key');

// ---- key practice ----
const allK=new Set(KEYORDER);
const core=['home','top','bottom','shift'].map(id=>KSETS.find(k=>k.id===id));
const union=core.flatMap(k=>k.keys);
if(union.length!==new Set(union).size)bad('key sets overlap');
if(new Set(union).size!==allK.size||union.some(j=>!allK.has(j)))bad('key sets must cover every key exactly once',union.length,allK.size);
KSETS.forEach(k=>k.keys.forEach(j=>{if(!JAMO2KEY[j])bad('set key untypable',j)}));
if(KSETS.find(k=>k.id==='all').keys.length!==33)bad('all keys should be 33',KSETS.find(k=>k.id==='all').keys.length);
// the row sets really are those rows
const rowOf=j=>ROWS.findIndex(r=>r.includes(JAMO2KEY[j].code.slice(3)));
if(!KSETS[0].keys.every(j=>rowOf(j)===1))bad('home set not on home row');
if(!KSETS[1].keys.every(j=>rowOf(j)===0))bad('top set not on top row');
if(!KSETS[2].keys.every(j=>rowOf(j)===2))bad('bottom set not on bottom row');
if(!KSETS[3].keys.every(j=>JAMO2KEY[j].shift))bad('shift set must be shifted');
const L=c=>locDesc(c);
if(L('KeyQ')!=='top row · far left')bad('Q',L('KeyQ'));
if(L('KeyP')!=='top row · far right')bad('P',L('KeyP'));
if(L('KeyO')!=='top row · 2nd from right')bad('O',L('KeyO'));
if(L('KeyW')!=='top row · 2nd from left')bad('W',L('KeyW'));
if(L('KeyE')!=='top row · 3rd from left')bad('E',L('KeyE'));
if(L('KeyG')!=='middle row · 5th from left')bad('G',L('KeyG'));
if(L('KeyH')!=='middle row · 4th from right')bad('H',L('KeyH'));
if(L('KeyZ')!=='bottom row · far left')bad('Z',L('KeyZ'));
if(L('KeyM')!=='bottom row · far right')bad('M',L('KeyM'));
Object.keys(KEY).forEach(c=>{if(!/^(top|middle|bottom) row · (far left|far right|\d+(st|nd|rd|th) from (left|right))$/.test(L(c)))bad('locDesc format',c,L(c))});
if(new Set(Object.keys(KEY).map(L)).size!==26)bad('every key needs a unique description',new Set(Object.keys(KEY).map(L)).size);
if(masteryOf(undefined)!=='none'||masteryOf({n:0,miss:0})!=='none')bad('mastery none');
if(masteryOf({n:3,miss:0})!=='good'||masteryOf({n:1,miss:0})!=='ok'||masteryOf({n:4,miss:2})!=='weak'||masteryOf({n:10,miss:1})!=='good'||masteryOf({n:5,miss:2})!=='ok')bad('mastery levels');
// prompts
[1,3,7,9,10,33].forEach(n=>{
  const keys=KEYORDER.slice(0,n),c=promptCount(n),pr=buildPrompts(keys,{},c);
  if(pr.length!==c)bad('prompt count',n,pr.length,c);
  if(c>=n&&!keys.every(k=>pr.includes(k)))bad('every key must appear when count>=size',n);
  if(c<n&&new Set(pr).size!==c)bad('sampled prompts must be unique when count<size',n);
  if(n>1)for(let i=1;i<pr.length;i++)if(pr[i]===pr[i-1])bad('immediate repeat',n,i);
  if(pr.some(j=>!keys.includes(j)))bad('foreign prompt');
});
// weighting: a key you always miss should be asked far more often than one you always get right
{const keys=KSETS[0].keys,stats={};keys.forEach(k=>stats[k]={n:10,miss:0});stats['ㅁ']={n:10,miss:10};
 let hard=0,easy=0;for(let r=0;r<400;r++){buildPrompts(keys,stats,18).forEach(j=>{if(j==='ㅁ')hard++;else if(j==='ㄴ')easy++;});}
 if(!(hard>easy*2))bad('weak key not weighted up',hard,easy);}
if(promptCount(3)<10)bad('tiny sets need repeats');
console.log(fail?`${fail} FAILURES`:'ALL ENGINE TESTS PASSED','| packs:',LESSONS.length,'| words:',LESSONS.reduce((a,l)=>a+l.items.length,0),'| new keys in pack 1:',newKeys(0).length);
process.exit(fail?1:0);
