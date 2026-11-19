/* Hangul Hop — UI, game modes, sound, PWA glue. Depends on engine.js. */
// ---------- helpers ----------
const $=s=>document.querySelector(s);
const app=$('#app');
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const stars=(n,sz)=>'★'.repeat(n)+'<i>★</i>'.repeat(3-n);
let save={stars:{},best:{},mute:false,hints:true,placed:null,keyStats:{},keyBest:{}};
try{Object.assign(save,JSON.parse(localStorage.getItem('hangulhop')||'{}'));}catch(e){}
const persist=()=>{try{localStorage.setItem('hangulhop',JSON.stringify(save));}catch(e){}};

let ac;
function tone(f,d=.12,type='sine',v=.07,when=0){
  if(save.mute)return;
  try{ac=ac||new(window.AudioContext||window.webkitAudioContext)();
    const t=ac.currentTime+when,o=ac.createOscillator(),g=ac.createGain();
    o.type=type;o.frequency.value=f;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);
    o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+d+.02);}catch(e){}
}
const sfx={
  key:()=>tone(620+Math.random()*180,.08,'sine',.05),
  ok:()=>[784,988,1175].forEach((f,i)=>tone(f,.18,'triangle',.07,i*.07)),
  bad:()=>tone(210,.16,'sine',.07),
  win:()=>[523,659,784,1047,1319].forEach((f,i)=>tone(f,.28,'triangle',.07,i*.1))
};
function updMute(){$('#mute').textContent=save.mute?'🔕 Sound off':'🔔 Sound on';}
$('#mute').onclick=()=>{save.mute=!save.mute;persist();updMute();sfx.ok();};
updMute();

function burst(el,n=12){
  const r=el?el.getBoundingClientRect():{left:innerWidth/2,top:innerHeight/3,width:0,height:0};
  const cx=r.left+r.width/2,cy=r.top+r.height/2,em=['✦','💖','⭐','🌸','✨','💜'];
  for(let i=0;i<n;i++){
    const s=document.createElement('span');s.className='pt';s.textContent=em[i%em.length];
    const a=Math.random()*6.28,d=60+Math.random()*90;
    s.style.cssText=`left:${cx}px;top:${cy}px;--dx:${Math.cos(a)*d}px;--dy:${Math.sin(a)*d-30}px;--r:${Math.random()*200-100}deg`;
    document.body.appendChild(s);setTimeout(()=>s.remove(),950);
  }
}
function confetti(n=40){
  const em=['🌸','✨','💖','⭐','🎀','💜','🍓'];
  for(let i=0;i<n;i++){
    const s=document.createElement('span');s.className='fall';s.textContent=em[i%em.length];
    s.style.left=Math.random()*100+'vw';s.style.fontSize=(16+Math.random()*18)+'px';
    s.style.animationDuration=(2.2+Math.random()*2)+'s';s.style.animationDelay=Math.random()*.8+'s';
    document.body.appendChild(s);setTimeout(()=>s.remove(),5200);
  }
}

// ---------- mascot ----------
function mascot(cls=''){return `<svg class="mascot ${cls}" viewBox="0 0 200 200" aria-hidden="true">
 <ellipse cx="68" cy="50" rx="20" ry="46" fill="#fff" stroke="#f0d2e4" stroke-width="3" transform="rotate(-12 68 50)"/>
 <ellipse cx="68" cy="56" rx="10" ry="30" fill="#ffc9e0" transform="rotate(-12 68 56)"/>
 <ellipse cx="132" cy="50" rx="20" ry="46" fill="#fff" stroke="#f0d2e4" stroke-width="3" transform="rotate(12 132 50)"/>
 <ellipse cx="132" cy="56" rx="10" ry="30" fill="#ffc9e0" transform="rotate(12 132 56)"/>
 <ellipse cx="100" cy="124" rx="72" ry="58" fill="#fff" stroke="#f0d2e4" stroke-width="3"/>
 <path d="M146 92 l-20-9 v18 z M146 92 l20-9 v18 z" fill="#b9a4ff"/><circle cx="146" cy="92" r="5.5" fill="#e2d8ff"/>
 <circle cx="56" cy="138" r="13" fill="#ffb3d1" opacity=".65"/><circle cx="144" cy="138" r="13" fill="#ffb3d1" opacity=".65"/>
 <g class="eyes-n"><ellipse cx="76" cy="120" rx="7.5" ry="9.5" fill="#4a3b5c"/><circle cx="73" cy="116" r="2.8" fill="#fff"/>
  <ellipse cx="124" cy="120" rx="7.5" ry="9.5" fill="#4a3b5c"/><circle cx="121" cy="116" r="2.8" fill="#fff"/></g>
 <g class="eyes-h" fill="none" stroke="#4a3b5c" stroke-width="4.5" stroke-linecap="round"><path d="M67 123 Q76 109 85 123"/><path d="M115 123 Q124 109 133 123"/></g>
 <ellipse cx="100" cy="134" rx="4.5" ry="3.2" fill="#ff9ec7"/>
 <path d="M91 142 Q95.5 149 100 142 Q104.5 149 109 142" fill="none" stroke="#4a3b5c" stroke-width="3" stroke-linecap="round"/>
</svg>`;}
function mood(happy){const m=document.querySelector('.mascot');if(!m)return;
  m.classList.toggle('happy',!!happy);m.classList.remove('hop');void m.getBoundingClientRect();if(happy){m.classList.add('hop');setTimeout(()=>m.classList.remove('happy'),900);}}
function say(t){const b=$('#say');if(b)b.textContent=t;}
const CHEER=['Great job!','You did it! 🎉','So cute!','Yay! 🎀','Amazing!','대박! (daebak!)','Perfect ✨','Hop hop hooray!','잘했어요! (well done!)'];

// ---------- keyboard ----------
function keyboardHTML(dock){
  return `<div class="kbwrap${dock?' dock':''}"><div class="kb" id="kb">`+ROWS.map((r,ri)=>`<div class="kr r${ri}">`+
    (ri===2?'<button class="key wide shiftk" data-act="shift" tabindex="-1"><span class="d">Shift</span><span class="m">⇧</span></button>':'')+
    r.map(L=>{const [a,b]=KEY['Key'+L];
      return `<button class="key ${isV(a)?'v':'c'}${'FJ'.includes(L)?' home':''}" data-code="Key${L}"${b?' data-hs':''} tabindex="-1"><span class="jm">${a}</span>${b?`<span class="sh">${b}</span>`:''}<span class="lt">${L}</span></button>`;}).join('')+
    (ri===2?'<button class="key wide" data-act="back" tabindex="-1">⌫</button>':'')+`</div>`).join('')+
    `<div class="kr r3"><button class="key space" data-code="Space" tabindex="-1">space</button></div></div></div><div class="legend"><span><i style="background:var(--pink)"></i>consonants (left)</span><span><i style="background:var(--lav)"></i>vowels (right)</span></div>`;
}
let shiftHeld=false,vshift=false;
function updShift(){const kb=$('#kb');if(kb)kb.classList.toggle('shifted',shiftHeld||vshift);}
function hl(next,glow){
  document.querySelectorAll('.key').forEach(k=>k.classList.remove('next','glow'));
  if(next){const k=document.querySelector(`.key[data-code="${next.code}"]`);k&&k.classList.add('next');
    if(next.shift){const s=document.querySelector('.shiftk');s&&s.classList.add('next');}}
  (glow||[]).forEach(c=>{const k=document.querySelector(c==='SHIFT'?'.shiftk':`.key[data-code="${c}"]`);k&&k.classList.add('glow');});
}
function pressAnim(code){const k=document.querySelector(`.key[data-code="${code}"]`);if(k){k.classList.add('down');setTimeout(()=>k.classList.remove('down'),110);}}
function keyPop(k){
  if(!k.dataset.code||k.dataset.code==='Space')return;
  const sh=k.querySelector('.sh'),shifted=$('#kb')&&$('#kb').classList.contains('shifted');
  const el=document.createElement('div');el.className='keypop';el.textContent=(shifted&&sh)?sh.textContent:k.querySelector('.jm').textContent;
  const r=k.getBoundingClientRect();el.style.left=Math.min(Math.max(r.left+r.width/2,38),innerWidth-38)+'px';el.style.top=(r.top-4)+'px';
  document.body.appendChild(el);setTimeout(()=>el.remove(),190);
}
function wireKeyboard(){
  document.querySelectorAll('.kb .key').forEach(k=>{
    k.addEventListener('pointerdown',e=>{
      e.preventDefault();
      if(k.dataset.act==='shift'){vshift=!vshift;updShift();return;}
      if(k.dataset.act==='back'){mode&&mode.back&&mode.back();return;}
      try{navigator.vibrate&&navigator.vibrate(6);}catch(_){}
      keyPop(k);
      const sh=shiftHeld||vshift;vshift=false;updShift();
      pressAnim(k.dataset.code);mode&&mode.key&&mode.key(k.dataset.code,sh);
    });
  });
}

// ---------- screen / mode plumbing ----------
let mode=null;
function setScreen(html,onMount){
  if(mode&&mode.cleanup)mode.cleanup();
  mode=null;vshift=false;
  app.innerHTML=`<div class="screen">${html}</div>`;
  if(document.activeElement)document.activeElement.blur();
  document.body.classList.toggle('has-dock',!!app.querySelector('.kbwrap.dock'));
  if(onMount)onMount();
  const p=app.querySelector('.btn.primary');if(p&&!mode)p.focus({preventScroll:true});
  scrollTo(0,0);
}
addEventListener('keydown',e=>{
  if(e.key==='Shift'){shiftHeld=true;updShift();return;}
  if(!mode||e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.code==='Escape'){mode.esc&&mode.esc();return;}
  if(e.code==='Backspace'){e.preventDefault();mode.back&&mode.back();return;}
  if(e.code==='Tab'&&mode.skip){e.preventDefault();mode.skip();return;}
  if(e.code==='Space'||KEY[e.code]){e.preventDefault();pressAnim(e.code);mode.key&&mode.key(e.code,e.shiftKey);}
},true);
addEventListener('keyup',e=>{if(e.key==='Shift'){shiftHeld=false;updShift();}});
addEventListener('blur',()=>{shiftHeld=false;updShift();});
const MQ=matchMedia('(max-width:700px)');
function keyHint(j,next,pre){
  const face=jshow(j),sp=next.code==='Space';
  if(MQ.matches)return `${pre?'Almost! ':''}Tap ${next.shift?'<b>⇧</b> then ':''}<b>${sp?'space':face}</b>`;
  return `${pre||'Next: '}<b>${face}</b> → press ${next.shift?'<b>Shift</b> + ':''}<b>${kname(next.code)}</b>${pre?'':` <small>(${FINGER[kname(next.code)]})</small>`}`;
}
const fitCls=kr=>kr.length>=14?'t-xlong':kr.length>=7?'t-long':'';
function fit(el,kr){el.classList.remove('t-long','t-xlong');const c=fitCls(kr);if(c)el.classList.add(c);}
const jamoFor=(code,shift)=>{if(code==='Space')return ' ';const k=KEY[code];return shift&&k[1]?k[1]:k[0];};
$('#logo').onclick=()=>home();

// ---------- HOME ----------
function totalStars(){return Object.values(save.stars).reduce((a,b)=>a+b,0);}
function home(){
  const best=Math.max(0,...Object.values(save.best));
  const pl=save.placed,lv=pl?PLEVELS[pl.p]:null;
  setScreen(`<div class="card hero">
    <div class="row" style="flex-wrap:nowrap">${mascot('bob')}<div class="bubble jua" id="say">${pl?'Welcome back! Ready to keep hopping?':'안녕! (annyeong!) Let\'s learn to type Korean together!'}</div></div>
    <h1>Hangul Hop</h1><div class="ko">한글 폴짝 · typing for cuties</div>
    <p>You already know the words from Duolingo — now let's make your fingers know them too! Take a quick test and we'll start you at the perfect lesson.</p>
    <div class="row">
      ${pl?`<button class="btn primary big" id="bLessons">🌸 Continue learning</button><button class="btn mint big" id="bSpeed">⏱ Speed Test</button>`
          :`<button class="btn primary big" id="bPlace">🎯 Find my level</button><button class="btn mint big" id="bLessons">🌸 Browse lessons</button><button class="btn ghost big" id="bSpeed">⏱ Speed Test</button>`}
      <button class="btn mint big" id="bKeys">🔑 Key Practice</button>
      <button class="btn ghost big" id="bFree">🎈 Free Play</button>
    </div>
    ${pl?`<div class="level-chip">${lv[1]} Your level: ${lv[0]} <button id="bRetake">retake test</button></div>`:''}
    <div class="install" id="install"></div>
    <div class="stats">
      <div class="stat"><b>${totalStars()} / ${LESSONS.length*3}</b>stars collected</div>
      <div class="stat"><b>${best||'–'}</b>best 타수 / min</div>
    </div>
    <div class="note">Type on your keyboard (or tap the on-screen keys on a phone). Works with any normal English keyboard.</div>
  </div>`,()=>{$('#bLessons').onclick=lessonMap;$('#bSpeed').onclick=speedSetup;$('#bFree').onclick=freePlay;$('#bKeys').onclick=()=>keySetup();
    if($('#bPlace'))$('#bPlace').onclick=placementIntro;if($('#bRetake'))$('#bRetake').onclick=placementIntro;
    renderInstall();});
}

// ---------- KEY PRACTICE ----------
const setGlow=keys=>keys.map(j=>JAMO2KEY[j].code).concat(keys.some(j=>JAMO2KEY[j].shift)?['SHIFT']:[]);
const weakKeys=()=>KEYORDER.filter(j=>{const s=save.keyStats[j];return s&&s.n>=1&&masteryOf(s)==='weak';});
const keyStars=id=>Math.max(save.keyBest[id+':p']||0,save.keyBest[id+':b']||0);
function keySetup(sel){
  sel=sel||{id:'home',blind:false};
  const weak=weakKeys(),sets=KSETS.concat(weak.length?[{id:'weak',name:'My weak keys',emoji:'💪',keys:weak}]:[]);
  if(!sets.find(x=>x.id===sel.id))sel.id='home';
  setScreen(`<div class="card setup">
    <div class="topbar" style="margin:0;width:100%"><button class="btn ghost" id="back">← Home</button><h2>🔑 Key Practice</h2></div>
    <div class="row" style="flex-wrap:nowrap">${mascot('bob')}<div class="bubble jua">A letter pops up — find its key as fast as you can! The more you play, the more your fingers just <i>know</i>. ✨</div></div>
    <div><h3>Which keys?</h3><div class="setchips" id="sets">${sets.map(x=>`<button class="sch" data-id="${x.id}">${x.emoji} ${x.name}<small>${x.keys.length} keys${x.id==='weak'?'':' · '+'★'.repeat(keyStars(x.id))+'☆'.repeat(3-keyStars(x.id))}</small></button>`).join('')}</div></div>
    <div><h3>How?</h3><div class="seg" id="segB"><button data-v="0">👀 Peek</button><button data-v="1">🙈 Blind</button></div>
      <div class="note" id="bnote"></div></div>
    ${keyboardHTML()}
    <button class="btn primary big" id="go">Let's find keys! →</button>
  </div>`,()=>{
    const cur=()=>sets.find(x=>x.id===sel.id);
    function upd(){
      document.querySelectorAll('#sets .sch').forEach(b=>b.classList.toggle('on',b.dataset.id===sel.id));
      document.querySelectorAll('#segB button').forEach(b=>b.classList.toggle('on',(b.dataset.v==='1')===sel.blind));
      $('#bnote').innerHTML=sel.blind?'Blind: the key labels are hidden — remember where each letter lives!':'Peek: the keyboard shows every letter, so you can learn the layout.';
      $('#kb').classList.toggle('blind',sel.blind);hl(null,setGlow(cur().keys));
    }
    document.querySelectorAll('#sets .sch').forEach(b=>b.onclick=()=>{sel.id=b.dataset.id;upd();});
    document.querySelectorAll('#segB button').forEach(b=>b.onclick=()=>{sel.blind=b.dataset.v==='1';upd();});
    $('#back').onclick=home;
    $('#go').onclick=()=>{const x=cur();startKeyPractice({keys:x.keys,name:x.name,id:x.id,blind:sel.blind,sel});};
    upd();
  });
}
function startKeyPractice(o){
  const prompts=buildPrompts(o.keys,save.keyStats,promptCount(o.keys.length));
  const st={i:0,first:0,missed:false,t0:0,times:[],roundMiss:{},locked:false};
  const leave=()=>o.back?o.back():keySetup(o.sel);
  setScreen(`<div class="card play">
    <div class="topbar" style="margin:0"><button class="btn ghost" id="back">← Quit</button><div class="timer"><i id="bar" style="width:0"></i></div><b class="jua" id="cnt" style="font-size:20px;min-width:54px;text-align:right"></b></div>
    <div class="stage">${mascot('sm')}<div class="words"><div class="kprompt" id="kp"></div><div class="meta" id="ksound"></div></div></div>
    <div class="hint k" id="kfb"></div>
    ${keyboardHTML(true)}
  </div>`,()=>{
    wireKeyboard();$('#kb').classList.toggle('blind',!!o.blind);hl(null,[]);
    const where=(j)=>{const k=JAMO2KEY[j],L=locDesc(k.code);
      return MQ.matches?`${k.shift?'Shift + ':''}${L}`:`${k.shift?'Shift + ':''}<b>${kname(k.code)}</b> key · ${L} · ${FINGER[kname(k.code)]}`;};
    const flash=(code,cls,ms)=>{const el=document.querySelector(`.key[data-code="${code}"]`);if(!el)return;el.classList.add(cls,'reveal');setTimeout(()=>el.classList.remove(cls,'reveal'),ms);};
    function show(){
      const j=prompts[st.i];st.missed=false;st.locked=false;st.t0=Date.now();
      $('#kp').textContent=j;$('#ksound').innerHTML=`sounds like <b>${SOUND[j]}</b>${JAMO2KEY[j].shift?' · <b>needs Shift</b>':''}`;
      $('#cnt').textContent=`${st.i+1}/${prompts.length}`;$('#bar').style.width=(st.i/prompts.length*100)+'%';
      $('#kfb').innerHTML='Where is it? 🔎';hl(null,[]);
    }
    function finish(){
      const total=prompts.length,acc=st.first/total,avg=st.times.reduce((a,b)=>a+b,0)/Math.max(1,st.times.length);
      const sc=acc>=.9?3:acc>=.7?2:1,k=o.id+(o.blind?':b':':p');
      save.keyBest[k]=Math.max(save.keyBest[k]||0,sc);persist();
      sfx.win();confetti(sc*12+8);keyResult(o,{acc:Math.round(acc*100),avg,sc,roundMiss:st.roundMiss,total});
    }
    mode={
      key(code,sh){
        if(st.locked||code==='Space')return;
        const target=prompts[st.i],tk=JAMO2KEY[target],j=jamoFor(code,sh);
        if(j===target){
          st.locked=true;st.times.push(Date.now()-st.t0);
          const s=save.keyStats[target]||(save.keyStats[target]={n:0,miss:0});s.n++;
          if(st.missed){s.miss++;st.roundMiss[target]=(st.roundMiss[target]||0)+1;}else st.first++;
          persist();flash(code,'good',900);sfx.ok();
          if(!st.missed){mood(true);burst($('#kp'),8);}
          $('#kfb').innerHTML=`<span class="ok">✓ <b>${target}</b> lives on:</span> ${where(target)}`;
          setTimeout(()=>{st.i++;st.i>=prompts.length?finish():show();},st.missed?1300:950);
        }else{
          st.missed=true;sfx.bad();
          const kp=$('#kp');kp.classList.remove('wiggle');void kp.offsetWidth;kp.classList.add('wiggle');
          flash(code,'bad',1100);
          $('#kfb').innerHTML=`That key is <b>${j===' '?'space':j}</b>. Look for <b>${target}</b> — ${where(target)}`;
          hl({code:tk.code,shift:tk.shift});
        }
      },
      esc:leave
    };
    $('#back').onclick=leave;show();
  });
}
function keyResult(o,r){
  const miss=Object.entries(r.roundMiss).sort((a,b)=>b[1]-a[1]).slice(0,8),weak=weakKeys();
  setScreen(`<div class="card result">
    ${mascot('hop happy')}
    <div class="rank">${r.sc===3?'Key master!':r.sc===2?'Getting there!':'Good practice!'}</div>
    <div class="bigstars">${stars(r.sc)}</div>
    <div class="stats"><div class="stat"><b>${r.acc}%</b>found first try</div><div class="stat"><b>${(r.avg/1000).toFixed(1)}s</b>avg per key</div><div class="stat"><b>${o.blind?'🙈':'👀'}</b>${o.blind?'blind':'peek'}</div></div>
    ${miss.length?`<div><h3 style="margin:0 0 8px">Keys to remember</h3><div class="missed">${miss.map(([j,n])=>`<div class="chip"><b>${j}</b><span>${locDesc(JAMO2KEY[j].code)}</span></div>`).join('')}</div></div>`:'<div class="note" style="margin:0">Perfect — no misses! 🎉</div>'}
    <div><h3 style="margin:0 0 6px">Your key map</h3>${keyboardHTML()}
      <div class="heat-legend"><span><i style="background:var(--mint2)"></i>know it</span><span><i style="background:var(--butter)"></i>getting there</span><span><i style="background:#ffb3c1"></i>needs practice</span><span><i style="background:#ddd"></i>not tried</span></div></div>
    <div class="row"><button class="btn primary" id="again">↻ Again</button>
      ${weak.length?`<button class="btn mint" id="weak">💪 Weak keys (${weak.length})</button>`:''}
      <button class="btn ghost" id="more">${o.back?'← Back to lesson':'Change keys'}</button></div>
  </div>`,()=>{
    document.querySelectorAll('.kb .key[data-code]').forEach(k=>{
      if(!KEY[k.dataset.code])return;   // the space bar has no letter
      const ms=KEY[k.dataset.code].map(j=>masteryOf(save.keyStats[j])).filter(m=>m!=='none');
      k.classList.add('m-'+(ms.includes('weak')?'weak':ms.includes('ok')?'ok':ms.includes('good')?'good':'none'));
    });
    $('#again').onclick=()=>startKeyPractice(o);
    if($('#weak'))$('#weak').onclick=()=>startKeyPractice({keys:weak,name:'Weak keys',id:'weak',blind:o.blind,sel:{id:'weak',blind:o.blind}});
    $('#more').onclick=()=>o.back?o.back():keySetup(o.sel);
  });
}

// ---------- PLACEMENT TEST ----------
function placementIntro(){
  setScreen(`<div class="card setup">
    <div class="topbar" style="margin:0;width:100%"><button class="btn ghost" id="back">← Back</button><h2>🎯 Find my level</h2></div>
    <div class="row" style="flex-wrap:nowrap">${mascot('bob')}<div class="bubble jua">Let's see what you can already type! I'll start easy and get trickier. No hints this time — and it's totally okay to get stuck. 🌸</div></div>
    <div class="bands">${PLACE.map((b,i)=>`<div class="band"><b class="jua">${i+1}</b> ${b.name}<span>${b.words[0][3]}</span></div>`).join('')}</div>
    <div class="note" style="margin:0;max-width:440px">About 3 minutes. It stops when things get tricky, then we pick the best lesson for you.<br>Backspace fixes typos — a few are fine. Tap "I don't know" any time.</div>
    <button class="btn primary big" id="go">Start the test →</button>
    <button class="btn ghost" id="beg">I'm brand new — start at lesson 1</button>
  </div>`,()=>{
    $('#back').onclick=home;$('#go').onclick=startPlacement;
    $('#beg').onclick=()=>{save.placed={start:0,p:0,cpm:0};persist();lessonMap();};
  });
}
function startPlacement(){
  const st={band:0,w:0,passed:0,chars:0,secs:0,buf:[],tj:[],cur:null,t0:0,tFirst:0,wrong:0,allowed:3,limit:30,timer:null,over:false,locked:false,results:[]};
  setScreen(`<div class="card play">
    <div class="topbar" style="margin:0"><button class="btn ghost" id="back">← Quit</button><div class="timer"><i id="bar"></i></div><b class="jua" id="clock" style="font-size:24px;min-width:54px;text-align:right">30</b></div>
    <div class="stagelbl" id="lbl"></div>
    <div class="stage">${mascot('sm')}<div class="words"><div class="target" id="target"></div><div class="meta" id="meta"></div><div class="typed" id="typed"></div></div></div>
    <div class="hint"><button class="btn ghost" id="idk" style="font-size:15px;padding:6px 16px">🙈 I don't know this one</button></div>
    ${keyboardHTML(true)}
  </div>`,()=>{
    wireKeyboard();hl(null,[]);
    const typed=$('#typed');
    const prefixOK=()=>st.buf.length<=st.tj.length&&st.buf.every((x,k)=>x===st.tj[k]);
    const show=()=>{typed.innerHTML=compose(st.buf)+'<span class="caret"></span>';typed.classList.toggle('off',!prefixOK());};
    function loadWord(){
      const b=PLACE[st.band];st.cur=b.words[st.w];st.tj=decomp(st.cur[0]);st.buf=[];st.wrong=0;
      st.allowed=3+Math.floor(st.tj.length/8);st.limit=b.limit;st.t0=Date.now();st.tFirst=0;st.locked=false;
      $('#target').textContent=st.cur[0];fit($('#target'),st.cur[0]);fit(typed,st.cur[0]);
      $('#meta').innerHTML=`${st.cur[3]} <b>${st.cur[1]}</b> · ${st.cur[2]}`;
      $('#lbl').textContent=`Stage ${st.band+1} of ${PLACE.length} · ${b.name} · word ${st.w+1}/2`;
      show();
    }
    function finish(){
      st.over=true;clearInterval(st.timer);
      const p=st.passed,cpm=st.secs>0?Math.round(st.chars/st.secs*60):0;
      const start=p>=PLACE.length?PLACE_PASSED_ALL:PLACE[p].start;
      save.placed={start,p,cpm};persist();
      sfx.win();confetti(30);placementResult(p,cpm,st.results);
    }
    function pass(){
      st.locked=true;const el=(Date.now()-(st.tFirst||st.t0))/1000;
      st.chars+=st.tj.length;st.secs+=Math.max(el,.5);
      sfx.ok();mood(true);burst($('#target'),10);typed.style.boxShadow='inset 0 0 0 4px var(--mint2)';
      setTimeout(()=>{typed.style.boxShadow='';
        if(st.w===0){st.w=1;loadWord();}
        else{st.results.push(true);st.passed++;st.w=0;st.band++;st.band>=PLACE.length?finish():loadWord();}},650);
    }
    function failStage(){if(st.over||st.locked)return;st.locked=true;st.results.push(false);sfx.bad();setTimeout(finish,350);}
    st.timer=setInterval(()=>{if(st.over||st.locked)return;
      const left=st.limit-(Date.now()-st.t0)/1000;
      $('#bar').style.width=Math.max(0,left/st.limit*100)+'%';$('#clock').textContent=Math.max(0,Math.ceil(left));
      if(left<=0)failStage();},100);
    mode={
      key(code,sh){
        if(st.over||st.locked)return;
        if(!st.tFirst)st.tFirst=Date.now();
        st.buf.push(jamoFor(code,sh));sfx.key();show();
        if(!prefixOK()){st.wrong++;sfx.bad();typed.classList.remove('wiggle');void typed.offsetWidth;typed.classList.add('wiggle');
          if(st.wrong>st.allowed)return failStage();}
        else if(st.buf.length===st.tj.length&&compose(st.buf)===st.cur[0])pass();
      },
      back(){if(st.over||st.locked||!st.buf.length)return;st.buf.pop();show();},
      esc:home,
      cleanup(){clearInterval(st.timer);}
    };
    $('#back').onclick=home;$('#idk').onclick=failStage;
    loadWord();
  });
}
function placementResult(p,cpm,results){
  const [name,em]=PLEVELS[p],start=Math.min(save.placed.start,LESSONS.length-1),L=LESSONS[start];
  const msg=p===0?'No worries — everybody starts somewhere! We\'ll begin with everyday words and the glowing hints will guide you.'
    :p<PLACE.length?`You can already handle: <b>${PLACE.slice(0,p).map(b=>b.name).join(', ')}</b>. Next up is <b>${PLACE[p].name}</b>!`
    :'You aced every stage, even full sentences! Time to tackle the longest ones.';
  setScreen(`<div class="card result">
    <div style="font-size:64px">${em}</div><div class="rank">${name}</div>
    <div class="bands">${PLACE.map((b,i)=>`<div class="band ${i<p?'ok':i===p?'no':''}"><b class="jua">${i+1}</b> ${b.name}<span>${i<p?'✓ passed':i===p?"let's practice!":'🔒 not yet'}</span></div>`).join('')}</div>
    ${cpm?`<div class="stat"><b>${cpm}</b>타수 / min on the words you passed</div>`:''}
    <div class="note" style="margin:0;max-width:460px">${msg}</div>
    <div class="recc">We recommend starting at<br><span class="sample">${L.emoji} Lesson ${start+1}: ${L.title}</span></div>
    <div class="row"><button class="btn primary big" id="go">Start there →</button><button class="btn ghost" id="map">All lessons</button><button class="btn mint" id="again">Retake</button></div>
  </div>`,()=>{$('#go').onclick=()=>lessonIntro(start);$('#map').onclick=lessonMap;$('#again').onclick=placementIntro;});
}

// ---------- LESSON MAP ----------
function lessonMap(){
  const pl=save.placed,from=pl?pl.start:0;
  let nextI=LESSONS.findIndex((l,i)=>i>=from&&!(save.stars[l.id]>0));
  if(nextI<0)nextI=LESSONS.findIndex(l=>!(save.stars[l.id]>0));
  let lastG='',cards='';
  LESSONS.forEach((l,i)=>{
    if(l.group!==lastG){lastG=l.group;cards+=`<h3 class="grp">${l.group}</h3>`;}
    const skipped=pl&&i<from&&!(save.stars[l.id]>0);
    cards+=`<button class="lcard c${i%6}${i===nextI?' next':''}" data-i="${i}">
      <span class="num">${i+1}</span><div class="em">${l.emoji}</div><h3>${l.title}</h3>
      <div class="sample">${l.items.slice(0,(l.group==='Everyday words'||l.group==='Power-ups')?2:1).map(w=>w[0]).join(' · ')}</div>
      ${skipped?'<span class="passed-tag">✓ passed by the test</span>':`<div class="stars">${stars(save.stars[l.id]||0)}</div>`}</button>`;
  });
  const banner=pl?`<div class="banner"><span>${PLEVELS[pl.p][1]}</span><span>Your level: <b>${PLEVELS[pl.p][0]}</b> — we picked <b>lesson ${Math.min(from,LESSONS.length-1)+1}: ${LESSONS[Math.min(from,LESSONS.length-1)].title}</b> for you.</span></div>`
    :`<div class="banner"><span>🎯</span><span>Not sure where to start? <button class="btn ghost" id="bPlace" style="font-size:15px;padding:6px 16px">Find my level</button></span></div>`;
  setScreen(`<div class="topbar"><button class="btn ghost" id="back">← Home</button><h2>Pick a lesson</h2></div>
  ${banner}<div class="grid">${cards}</div>`,
  ()=>{$('#back').onclick=home;if($('#bPlace'))$('#bPlace').onclick=placementIntro;
    document.querySelectorAll('.lcard').forEach(c=>c.onclick=()=>lessonIntro(+c.dataset.i));});
}

// ---------- LESSON INTRO ----------
function lessonIntro(i){
  const L=LESSONS[i],nk=newKeys(i);
  const chips=nk.map(j=>{const k=JAMO2KEY[j];return `<div class="chip"><b>${j}</b><span>${SOUND[j]}</span><br><span class="kn">${k.shift?'Shift + ':''}${kname(k.code)}</span></div>`;}).join('');
  const nShow=L.group==='Sentence Studio'?2:4;
  const words=L.items.slice(0,nShow).map(w=>`<span class="chip"><b>${w[0]}</b><span>${w[3]} ${w[2]}</span></span>`).join('');
  setScreen(`<div class="card intro">
    <div class="topbar" style="margin:0"><button class="btn ghost" id="back">← Lessons</button><h2>${L.emoji} ${i+1}. ${L.title}</h2></div>
    <div class="tip">💡 ${L.tip}</div>
    <div><h3 style="margin:0 0 8px">Words you'll type</h3><div class="chips">${words}<span class="chip" style="background:none;box-shadow:none;align-self:center">…and ${L.items.length-nShow} more!</span></div></div>
    ${chips?`<div><h3 style="margin:0 0 8px">New keys in this pack</h3><div class="chips">${chips}</div>
      ${nk.length>6?'<div class="note">That\'s a lot of new keys — don\'t worry! The hints will show you where to put your fingers. You\'ll learn by doing. 🌸</div>':''}</div>`:'<div class="note" style="margin:0">No new keys in this pack — just practice! 🎉</div>'}
    ${keyboardHTML()}
    <div class="row"><button class="btn primary big" id="go">Let's go! →</button>${nk.length?'<button class="btn mint" id="warm">🔑 Warm up these keys</button>':''}</div>
  </div>`,()=>{
    $('#back').onclick=lessonMap;$('#go').onclick=()=>startLesson(i);
    if($('#warm'))$('#warm').onclick=()=>startKeyPractice({keys:nk,name:'Pack keys',id:'pack'+i,blind:false,back:()=>lessonIntro(i)});
    wireKeyboard();hl(null,nk.map(j=>JAMO2KEY[j].code).concat(nk.some(j=>JAMO2KEY[j].shift)?['SHIFT']:[]));
    mode={key:()=>{sfx.key();},back(){}};
  });
}

// ---------- LESSON PLAY ----------
function startLesson(i){
  const L=LESSONS[i];
  const items=shuffle(L.items.slice()).slice(0,10);
  const st={r:0,mistakes:0,t0:Date.now(),buf:[],tj:[],locked:false,keys:0};
  setScreen(`<div class="card play">
    <div class="topbar" style="margin:0"><button class="btn ghost" id="back">← Quit</button>
      <div class="dots">${items.map(()=>'<span class="dot"></span>').join('')}</div>
      <button class="icon-btn toggle" id="hintbtn"></button></div>
    <div class="stage">${mascot('sm')}
      <div class="words"><div class="target" id="target"></div><div class="meta" id="meta"></div>
        <div class="typed" id="typed"></div></div></div>
    <div class="hint" id="hint"></div>
    ${keyboardHTML(true)}
  </div>`,()=>{
    wireKeyboard();
    const target=$('#target'),typed=$('#typed');
    const renderHintBtn=()=>{$('#hintbtn').textContent=save.hints?'💡 Hints on':'💡 Hints off';};
    function updateHint(){
      const next=JAMO2KEY[st.tj[st.buf.length]];
      if(save.hints&&next){hl(next);
        $('#hint').innerHTML=keyHint(st.tj[st.buf.length],next);
      } else {hl(null);$('#hint').innerHTML=save.hints?'':'<small>Hints are off — you can do it! 💪</small>';}
    }
    function showTyped(){typed.innerHTML=compose(st.buf)+'<span class="caret"></span>';}
    function loadRound(){
      const [kr,rom,mean,emo]=items[st.r];
      st.buf=[];st.tj=decomp(kr);st.locked=false;
      target.textContent=kr;fit(target,kr);fit(typed,kr);
      $('#meta').innerHTML=`${emo} <b>${rom}</b> · ${mean}`;
      document.querySelectorAll('.dot').forEach((d,k)=>{d.className='dot'+(k<st.r?' done':k===st.r?' cur':'');});
      showTyped();updateHint();
    }
    function finish(){
      const secs=(Date.now()-st.t0)/1000,sc=st.mistakes<=2?3:st.mistakes<=6?2:1;
      save.stars[L.id]=Math.max(save.stars[L.id]||0,sc);persist();
      sfx.win();confetti(sc*14+10);lessonResult(i,sc,st.mistakes,secs,st.keys);
    }
    mode={
      key(code,sh){
        if(st.locked)return;
        const j=jamoFor(code,sh),want=st.tj[st.buf.length];
        if(j===want){
          st.buf.push(j);st.keys++;sfx.key();showTyped();
          if(st.buf.length===st.tj.length){
            st.locked=true;hl(null);mood(true);say(CHEER[Math.random()*CHEER.length|0]);
            sfx.ok();burst(target,14);typed.style.boxShadow='inset 0 0 0 4px var(--mint2)';
            setTimeout(()=>{typed.style.boxShadow='';st.r++;st.r>=items.length?finish():loadRound();},750);
          } else updateHint();
        } else {
          st.mistakes++;sfx.bad();typed.classList.remove('wiggle');void typed.offsetWidth;typed.classList.add('wiggle');
          const nx=JAMO2KEY[want];hl(nx);
          if(!save.hints)$('#hint').innerHTML=`Oops! Try again 🌸`;
          else $('#hint').innerHTML=keyHint(want,nx,'Almost! You need ');
        }
      },
      back(){if(st.locked||!st.buf.length)return;st.buf.pop();showTyped();updateHint();},
      esc:lessonMap
    };
    $('#back').onclick=lessonMap;
    $('#hintbtn').onclick=()=>{save.hints=!save.hints;persist();renderHintBtn();updateHint();};
    renderHintBtn();loadRound();
  });
}
function lessonResult(i,sc,mistakes,secs,keys){
  const L=LESSONS[i],last=i===LESSONS.length-1;
  const msg=sc===3?'Flawless! You are a Hangul star!':sc===2?'Lovely work! Almost perfect.':'Nice try! Practice makes perfect — go again for more stars.';
  setScreen(`<div class="card result">
    ${mascot('hop happy')}
    <div class="rank">Lesson complete!</div>
    <div class="bigstars">${stars(sc)}</div>
    <div class="bubble jua" style="margin-left:10px">${msg}</div>
    <div class="stats"><div class="stat"><b>${mistakes}</b>oopsies</div><div class="stat"><b>${Math.round(keys/(secs/60))}</b>타수 / min</div><div class="stat"><b>${Math.round(secs)}s</b>time</div></div>
    <div class="row"><button class="btn ghost" id="again">↻ Again</button>
      ${last?'':`<button class="btn primary" id="nxt">Next lesson →</button>`}
      <button class="btn mint" id="map">Lesson list</button></div>
  </div>`,()=>{
    $('#again').onclick=()=>startLesson(i);$('#map').onclick=lessonMap;
    if(!last)$('#nxt').onclick=()=>lessonIntro(i+1);
  });
}

// ---------- SPEED TEST ----------
let speedOpt={secs:60,level:'easy'};
function speedSetup(){
  setScreen(`<div class="card setup">
    <div class="topbar" style="margin:0;width:100%"><button class="btn ghost" id="back">← Home</button><h2>⏱ Speed Test</h2></div>
    <div><h3>How long?</h3><div class="seg" id="segT">${[30,60,120].map(s=>`<button data-v="${s}" class="${speedOpt.secs===s?'on':''}">${s}s</button>`).join('')}</div></div>
    <div><h3>Which words?</h3><div class="seg" id="segL">
      <button data-v="easy" class="${speedOpt.level==='easy'?'on':''}">🍓 Cozy</button>
      <button data-v="hard" class="${speedOpt.level==='hard'?'on':''}">⭐ Sparkly</button>
      <button data-v="sent" class="${speedOpt.level==='sent'?'on':''}">📖 Sentences</button></div>
      <div class="note">Cozy = easy everyday words (no Shift).<br>Sparkly = every word, incl. Shift, compound vowels &amp; double finals.<br>Sentences = full phrases with the Space bar!</div></div>
    <div class="note" style="margin:0">Type each word — it flips to the next one automatically. Backspace fixes mistakes. Tab skips a word.<br>Your score is 타수 (keystrokes per minute), the Korean typing-speed standard.</div>
    <button class="btn primary big" id="go">Ready, set, type! →</button>
  </div>`,()=>{
    const seg=(id,key,conv)=>document.querySelectorAll(id+' button').forEach(b=>b.onclick=()=>{speedOpt[key]=conv(b.dataset.v);document.querySelectorAll(id+' button').forEach(x=>x.classList.toggle('on',x===b));});
    seg('#segT','secs',Number);seg('#segL','level',String);
    $('#back').onclick=home;$('#go').onclick=startSpeed;
  });
}
function startSpeed(){
  const {secs,level}=speedOpt;
  const pool=speedPool(level);
  const st={cur:null,tj:[],buf:[],queue:[],correct:0,pressed:0,words:0,syll:0,combo:0,maxCombo:0,started:false,t0:0,timer:null,over:false,last:null};
  const pick=()=>{let w;do{w=pool[Math.random()*pool.length|0];}while(w===st.last&&pool.length>1);st.last=w;return w;};
  setScreen(`<div class="card play">
    <div class="topbar" style="margin:0"><button class="btn ghost" id="back">← Quit</button><div class="timer"><i id="bar"></i></div><b class="jua" id="clock" style="font-size:24px;min-width:54px;text-align:right">${secs}</b></div>
    <div class="live"><div class="stat"><b id="lv">0</b>타수 / min</div><div class="stat"><b id="lw">0</b>words</div><div class="stat"><b id="la">100%</b>accuracy</div></div>
    <div class="combo" id="combo"></div>
    <div class="stage">${mascot('sm')}<div class="words"><div class="target" id="target"></div><div class="meta" id="meta"></div><div class="typed" id="typed"></div></div></div>
    <div class="queue" id="queue"></div>
    ${keyboardHTML(true)}
  </div>`,()=>{
    wireKeyboard();
    const typed=$('#typed');
    const stats=()=>{
      const el=st.started?Math.max((Date.now()-st.t0)/60000,1/60):0;
      $('#lv').textContent=el?Math.round(st.correct/el):0;
      $('#lw').textContent=st.words;
      $('#la').textContent=(st.pressed?Math.round(st.correct/st.pressed*100):100)+'%';
    };
    const showTyped=()=>{typed.innerHTML=compose(st.buf)+'<span class="caret"></span>';
      typed.classList.toggle('off',!st.buf.every((j,k)=>j===st.tj[k])||st.buf.length>st.tj.length);};
    function next(){
      while(st.queue.length<4)st.queue.push(pick());
      st.cur=st.queue.shift();st.tj=decomp(st.cur[0]);st.buf=[];
      $('#target').textContent=st.cur[0];fit($('#target'),st.cur[0]);fit(typed,st.cur[0]);$('#meta').innerHTML=`${st.cur[3]} <b>${st.cur[1]}</b> · ${st.cur[2]}`;
      $('#queue').innerHTML=st.queue.slice(0,3).map(w=>`<span>${w[0]}</span>`).join('');
      $('#combo').textContent=st.combo>=3?`🔥 combo ×${st.combo}`:'';
      showTyped();
      const nx=JAMO2KEY[st.tj[0]];hl(save.hints?nx:null);
    }
    function end(){
      st.over=true;clearInterval(st.timer);
      const el=secs/60,cpm=Math.round(st.correct/el),acc=st.pressed?Math.round(st.correct/st.pressed*100):0;
      const k='s'+secs+level;
      const isBest=cpm>(save.best[k]||0);if(isBest){save.best[k]=cpm;persist();}
      sfx.win();confetti(50);speedResult({cpm,acc,words:st.words,syll:st.syll,combo:st.maxCombo,isBest,prev:save.best[k]});
    }
    mode={
      key(code,sh){
        if(st.over)return;
        if(!st.started){st.started=true;st.t0=Date.now();
          st.timer=setInterval(()=>{const left=secs-(Date.now()-st.t0)/1000;
            $('#bar').style.width=Math.max(0,left/secs*100)+'%';$('#clock').textContent=Math.max(0,Math.ceil(left));stats();
            if(left<=0)end();},100);}
        const j=jamoFor(code,sh),wasOk=st.buf.every((x,k)=>x===st.tj[k]);
        st.buf.push(j);st.pressed++;sfx.key();showTyped();
        const nowOk=st.buf.every((x,k)=>x===st.tj[k])&&st.buf.length<=st.tj.length;
        if(wasOk&&!nowOk){st.combo=0;$('#combo').textContent='';sfx.bad();typed.classList.remove('wiggle');void typed.offsetWidth;typed.classList.add('wiggle');}
        if(nowOk&&compose(st.buf)===st.cur[0]&&st.buf.length===st.tj.length){
          st.correct+=st.tj.length;st.words++;st.syll+=st.cur[0].length;st.combo++;st.maxCombo=Math.max(st.maxCombo,st.combo);
          sfx.ok();burst($('#target'),8);mood(true);stats();next();
        } else if(save.hints){const nx=JAMO2KEY[st.tj[st.buf.length]];hl(nowOk?nx:null);}
      },
      back(){if(st.over||!st.buf.length)return;st.buf.pop();showTyped();
        if(save.hints){const ok=st.buf.every((x,k)=>x===st.tj[k]);hl(ok?JAMO2KEY[st.tj[st.buf.length]]:null);}},
      skip(){if(st.over||!st.started)return;st.combo=0;sfx.bad();next();},
      esc:home,
      cleanup(){clearInterval(st.timer);}
    };
    $('#back').onclick=home;
    next();
  });
}
function rankFor(c){
  if(c<60)return['Sleepy Sprout','🌱','Every master started here!'];
  if(c<120)return['Tiny Bunny','🐰','Hop hop — you\'re getting the hang of it!'];
  if(c<200)return['Happy Kitten','🐱','Your paws are warming up!'];
  if(c<300)return['Sparkle Star','⭐','That\'s a very respectable speed!'];
  if(c<400)return['Rainbow Unicorn','🦄','Wow, your fingers are magical!'];
  return['Cloud Queen','👑','Typing like royalty. Daebak!'];
}
function speedResult(r){
  const [name,em,msg]=rankFor(r.cpm);
  setScreen(`<div class="card result">
    <div style="font-size:64px">${em}</div><div class="rank">${name}</div>
    <div class="big-num">${r.cpm}<small> 타수 / min</small></div>
    ${r.isBest?'<div class="bubble jua">🎉 New personal best!</div>':`<div class="note" style="margin:0">Personal best: ${r.prev} 타수</div>`}
    <div class="jua" style="font-size:18px">${msg}</div>
    <div class="stats"><div class="stat"><b>${r.acc}%</b>accuracy</div><div class="stat"><b>${r.words}</b>words</div><div class="stat"><b>${r.syll}</b>syllables</div><div class="stat"><b>×${r.combo}</b>best combo</div></div>
    <div class="note" style="margin:0;max-width:440px">타수 counts every correct keystroke. Casual typists land around 150–250, fast typists 300–400+.</div>
    <div class="row"><button class="btn primary" id="again">↻ Try again</button><button class="btn mint" id="set">Change settings</button><button class="btn ghost" id="home">Home</button></div>
  </div>`,()=>{$('#again').onclick=startSpeed;$('#set').onclick=speedSetup;$('#home').onclick=home;});
}

// ---------- FREE PLAY ----------
function freePlay(){
  setScreen(`<div class="card play">
    <div class="topbar" style="margin:0"><button class="btn ghost" id="back">← Home</button><h2>🎈 Free Play</h2><button class="btn ghost" id="clear">Clear</button></div>
    <div class="note" style="margin:0">Type anything! Watch the letters snap together into Hangul blocks. Try ㅎ + ㅏ + ㄴ, then add ㄱ + ㅡ + ㄹ ✨</div>
    <div class="freebox" id="box"></div>
    <div class="jamolist" id="jl"></div>
    ${keyboardHTML(true)}
  </div>`,()=>{
    wireKeyboard();hl(null,[]);
    let buf=[];
    const show=()=>{$('#box').innerHTML=compose(buf)+'<span class="caret"></span>';$('#jl').textContent=buf.slice(-12).join(' ');};
    mode={key(code,sh){buf.push(jamoFor(code,sh));sfx.key();show();},back(){buf.pop();show();},esc:home};
    $('#back').onclick=home;$('#clear').onclick=()=>{buf=[];show();};
    show();
  });
}

// ---------- PWA: install button, update prompt, offline ----------
function toast(msg,label,fn){
  document.querySelectorAll('.toast').forEach(t=>t.remove());
  const t=document.createElement('div');t.className='toast';t.setAttribute('role','status');
  const s=document.createElement('span');s.textContent=msg;t.appendChild(s);
  if(label){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{t.remove();fn&&fn();};t.appendChild(b);}
  const x=document.createElement('button');x.className='x';x.setAttribute('aria-label','Dismiss');x.textContent='✕';x.onclick=()=>t.remove();t.appendChild(x);
  document.body.appendChild(t);
  if(!label)setTimeout(()=>t.remove(),5000);
}
let deferredInstall=null;
const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: minimal-ui)').matches||navigator.standalone===true;
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
function renderInstall(){
  const el=$('#install');if(!el)return;
  if(isStandalone()){el.innerHTML='';return;}
  if(deferredInstall){
    el.innerHTML='<button class="btn mint" id="bInstall">📲 Install the app</button>';
    $('#bInstall').onclick=async()=>{
      const ev=deferredInstall;deferredInstall=null;
      try{ev.prompt();await ev.userChoice;}catch(_){}
      renderInstall();
    };
  }else if(isIOS()){
    el.innerHTML='<div class="install-tip">📲 Install on your iPhone: tap <b>Share</b> (the square with an arrow), then <b>Add to Home Screen</b>.</div>';
  }else el.innerHTML='';
}
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;renderInstall();});
addEventListener('appinstalled',()=>{deferredInstall=null;renderInstall();toast('Installed! Find Hangul Hop on your home screen 🎉');});

if('serviceWorker' in navigator&&location.protocol.startsWith('http')){
  let reloading=false,wantsUpdate=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(wantsUpdate&&!reloading){reloading=true;location.reload();}});
  addEventListener('load',()=>{
    navigator.serviceWorker.register('sw.js').then(reg=>{
      const offer=w=>toast('✨ A new version is ready','Update',()=>{wantsUpdate=true;w.postMessage('SKIP_WAITING');});
      if(reg.waiting&&navigator.serviceWorker.controller)offer(reg.waiting);
      reg.addEventListener('updatefound',()=>{
        const w=reg.installing;if(!w)return;
        w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)offer(w);});
      });
      // look for a new version whenever the app comes back to the foreground
      document.addEventListener('visibilitychange',()=>{if(!document.hidden)reg.update().catch(()=>{});});
    }).catch(()=>{});
  });
}

// ---------- start (supports app-icon shortcuts like /#keys) ----------
const ROUTES={lessons:lessonMap,keys:()=>keySetup(),speed:speedSetup,free:freePlay,level:placementIntro};
function start(){
  const r=ROUTES[location.hash.slice(1)];
  if(r){history.replaceState(null,'',location.pathname+location.search);r();}else home();
}
start();
