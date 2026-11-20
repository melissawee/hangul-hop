/* Hangul Hop — pure engine (no DOM): keyboard map, Hangul composer, lesson data, placement, key-practice logic.
   Loaded as a classic script before app.js; also loaded by tests/engine.test.js. */
// ===================== ENGINE START =====================
// Korean "2-set" (두벌식) keyboard: physical key -> [normal, shifted] jamo
const KEY = {
  KeyQ:['ㅂ','ㅃ'],KeyW:['ㅈ','ㅉ'],KeyE:['ㄷ','ㄸ'],KeyR:['ㄱ','ㄲ'],KeyT:['ㅅ','ㅆ'],
  KeyY:['ㅛ'],KeyU:['ㅕ'],KeyI:['ㅑ'],KeyO:['ㅐ','ㅒ'],KeyP:['ㅔ','ㅖ'],
  KeyA:['ㅁ'],KeyS:['ㄴ'],KeyD:['ㅇ'],KeyF:['ㄹ'],KeyG:['ㅎ'],
  KeyH:['ㅗ'],KeyJ:['ㅓ'],KeyK:['ㅏ'],KeyL:['ㅣ'],
  KeyZ:['ㅋ'],KeyX:['ㅌ'],KeyC:['ㅊ'],KeyV:['ㅍ'],KeyB:['ㅠ'],KeyN:['ㅜ'],KeyM:['ㅡ']
};
const LEAD='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const VOW='ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const TAIL=['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const VCOMB={'ㅗㅏ':'ㅘ','ㅗㅐ':'ㅙ','ㅗㅣ':'ㅚ','ㅜㅓ':'ㅝ','ㅜㅔ':'ㅞ','ㅜㅣ':'ㅟ','ㅡㅣ':'ㅢ'};
const TCOMB={'ㄱㅅ':'ㄳ','ㄴㅈ':'ㄵ','ㄴㅎ':'ㄶ','ㄹㄱ':'ㄺ','ㄹㅁ':'ㄻ','ㄹㅂ':'ㄼ','ㄹㅅ':'ㄽ','ㄹㅌ':'ㄾ','ㄹㅍ':'ㄿ','ㄹㅎ':'ㅀ','ㅂㅅ':'ㅄ'};
const isV = c => VOW.includes(c);
const JAMO2KEY = {};
for (const [code,[a,b]] of Object.entries(KEY)) { JAMO2KEY[a]={code,shift:false}; if(b) JAMO2KEY[b]={code,shift:true}; }
JAMO2KEY[' ']={code:'Space',shift:false};
const kname=c=>c==='Space'?'Space':c.slice(3);
const jshow=j=>j===' '?'␣':j;
// keys a lesson needs that no earlier lesson used, in keyboard order
const KEYORDER=Object.values(KEY).flat();
function newKeys(i){
  const seen=new Set();
  LESSONS.slice(0,i).forEach(l=>l.items.forEach(w=>decomp(w[0]).forEach(j=>seen.add(j))));
  const now=new Set();LESSONS[i].items.forEach(w=>decomp(w[0]).forEach(j=>now.add(j)));
  return KEYORDER.filter(j=>now.has(j)&&!seen.has(j));
}

// Turn a stream of typed jamo into syllables, the way a Korean IME does.
function compose(j){
  let out='',i=0;const n=j.length;
  while(i<n){
    const c=j[i];
    if(LEAD.includes(c)&&i+1<n&&isV(j[i+1])){
      const L=LEAD.indexOf(c);let v=j[i+1];i+=2;
      if(i<n&&isV(j[i])&&VCOMB[v+j[i]]){v=VCOMB[v+j[i]];i++;}
      let t='';
      if(i<n&&!isV(j[i])&&TAIL.includes(j[i])){
        const a=j[i],b=j[i+1],cc=j[i+2];
        if(b!==undefined&&isV(b)){ /* a starts the next syllable */ }
        else if(b!==undefined&&TCOMB[a+b]&&!(cc!==undefined&&isV(cc))){t=TCOMB[a+b];i+=2;}
        else{t=a;i++;}
      }
      out+=String.fromCharCode(0xAC00+(L*21+VOW.indexOf(v))*28+TAIL.indexOf(t));
    } else {out+=c;i++;}
  }
  return out;
}
// Break syllables into the jamo keystrokes needed to type them.
function decomp(str){
  const r=[];
  for(const ch of str){
    const c=ch.charCodeAt(0)-0xAC00;
    if(c<0||c>11171){r.push(ch);continue;}
    const L=Math.floor(c/588),V=Math.floor((c%588)/28),T=c%28;
    r.push(LEAD[L]);
    const v=VOW[V];const vk=Object.keys(VCOMB).find(k=>VCOMB[k]===v);
    if(vk) r.push(vk[0],vk[1]); else r.push(v);
    if(T){const t=TAIL[T];const tk=Object.keys(TCOMB).find(k=>TCOMB[k]===t);
      if(tk) r.push(tk[0],tk[1]); else r.push(t);}
  }
  return r;
}
const SOUND={'ㄱ':'g / k','ㄴ':'n','ㄷ':'d / t','ㄹ':'r / l','ㅁ':'m','ㅂ':'b / p','ㅅ':'s','ㅇ':'silent / ng','ㅈ':'j','ㅊ':'ch','ㅋ':'k','ㅌ':'t','ㅍ':'p','ㅎ':'h',
 'ㄲ':'kk','ㄸ':'tt','ㅃ':'pp','ㅆ':'ss','ㅉ':'jj','ㅏ':'a','ㅑ':'ya','ㅓ':'eo','ㅕ':'yeo','ㅗ':'o','ㅛ':'yo','ㅜ':'u','ㅠ':'yu','ㅡ':'eu','ㅣ':'i','ㅐ':'ae','ㅒ':'yae','ㅔ':'e','ㅖ':'ye'};
const FINGER={Space:'thumb',Q:'left pinky',A:'left pinky',Z:'left pinky',W:'left ring finger',S:'left ring finger',X:'left ring finger',E:'left middle finger',D:'left middle finger',C:'left middle finger',
 R:'left index finger',F:'left index finger',V:'left index finger',T:'left index finger',G:'left index finger',B:'left index finger',
 Y:'right index finger',U:'right index finger',H:'right index finger',J:'right index finger',N:'right index finger',M:'right index finger',
 I:'right middle finger',K:'right middle finger',O:'right ring finger',L:'right ring finger',P:'right pinky'};

// ---------- word packs (lessons) ----------
// item = [korean, romanization, meaning, emoji]
const LESSONS=[
 {id:'greet',group:'Everyday words',title:'Hello & Thanks',emoji:'👋',
  tip:'You already know these from Duolingo — now let\'s teach your fingers! There are lots of new keys here, but the glowing hints will guide you. No need to memorize anything yet.',
  items:[['안녕','annyeong','hi / bye','👋'],['안녕하세요','annyeonghaseyo','hello','🙇'],['네','ne','yes','⭕'],['아니요','aniyo','no','❌'],['감사합니다','gamsahamnida','thank you','🙏'],['사랑해요','saranghaeyo','I love you','💕'],['미안해요','mianhaeyo','sorry','😢'],['좋아요','joayo','good / I like it','👍'],['여보세요','yeoboseyo','hello (phone)','📞'],['축하해요','chukahaeyo','congratulations','🎉'],['반갑습니다','bangapseumnida','nice to meet you','😊']]},
 {id:'family',group:'Everyday words',title:'Family & Friends',emoji:'👨‍👩‍👧',
  tip:'Just type the sounds in order and the blocks build themselves. In 엄마 the first ㅁ ends the first block, and the second ㅁ starts the next one!',
  items:[['엄마','eomma','mom','👩'],['가족','gajok','family','👨‍👩‍👧'],['친구','chingu','friend','🧑‍🤝‍🧑'],['아기','agi','baby','👶'],['사람','saram','person','🧍'],['동생','dongsaeng','younger sibling','🧒'],['할머니','halmeoni','grandmother','👵'],['할아버지','harabeoji','grandfather','👴'],['선생님','seonsaengnim','teacher','🧑‍🏫'],['언니','eonni','older sister','👭'],['누나','nuna','older sister (to a boy)','👧'],['아들','adeul','son','👦'],['이모','imo','aunt','👩‍🦰']]},
 {id:'food',group:'Everyday words',title:'Yummy Food',emoji:'🍜',
  tip:'Food words show up in every Korean lesson! Keep your fingers resting on the home row — feel the little bumps on F and J.',
  items:[['물','mul','water','💧'],['밥','bap','rice / meal','🍚'],['김치','gimchi','kimchi','🥬'],['라면','ramyeon','ramen','🍜'],['우유','uyu','milk','🥛'],['커피','keopi','coffee','☕'],['치킨','chikin','chicken','🍗'],['피자','pija','pizza','🍕'],['김밥','gimbap','gimbap','🍙'],['불고기','bulgogi','bulgogi','🥩'],['비빔밥','bibimbap','bibimbap','🍲'],['아이스크림','aiseukeurim','ice cream','🍦'],['바나나','banana','banana','🍌'],['포도','podo','grapes','🍇'],['토마토','tomato','tomato','🍅'],['수박','subak','watermelon','🍉'],['주스','juseu','juice','🧃'],['감자','gamja','potato','🥔']]},
 {id:'animals',group:'Everyday words',title:'Cute Animals',emoji:'🐾',
  tip:'Cute critters! Go slowly and aim for zero oopsies — speed comes later.',
  items:[['강아지','gangaji','puppy','🐶'],['고양이','goyangi','cat','🐱'],['호랑이','horangi','tiger','🐯'],['곰','gom','bear','🐻'],['사자','saja','lion','🦁'],['새','sae','bird','🐦'],['오리','ori','duck','🦆'],['하마','hama','hippo','🦛'],['거북이','geobugi','turtle','🐢'],['나비','nabi','butterfly','🦋'],['고래','gorae','whale','🐳'],['물고기','mulgogi','fish','🐟'],['사슴','saseum','deer','🦌'],['여우','yeou','fox','🦊'],['기린','girin','giraffe','🦒']]},
 {id:'things',group:'Everyday words',title:'Everyday Things',emoji:'🎒',
  tip:'Things you use every day. Notice how consonants on the LEFT and vowels on the RIGHT make a nice rhythm: left hand, right hand, left hand…',
  items:[['책','chaek','book','📖'],['가방','gabang','bag','🎒'],['우산','usan','umbrella','☂️'],['컴퓨터','keompyuteo','computer','💻'],['핸드폰','haendeupon','cell phone','📱'],['모자','moja','hat','🧢'],['신발','sinbal','shoes','👟'],['지갑','jigap','wallet','👛'],['안경','angyeong','glasses','👓'],['연필','yeonpil','pencil','✏️'],['침대','chimdae','bed','🛏️'],['문','mun','door','🚪'],['사진','sajin','photo','📷'],['편지','pyeonji','letter','✉️']]},
 {id:'places',group:'Everyday words',title:'Places to Go',emoji:'🏫',
  tip:'Where shall we go? 한국 (Korea) and 서울 (Seoul) are great ones to know how to type!',
  items:[['학교','hakgyo','school','🏫'],['집','jip','home','🏠'],['한국','hanguk','Korea','🇰🇷'],['서울','seoul','Seoul','🏙️'],['시장','sijang','market','🛒'],['식당','sikdang','restaurant','🍽️'],['카페','kape','café','☕'],['가게','gage','shop','🏪'],['바다','bada','sea','🌊'],['산','san','mountain','⛰️'],['공항','gonghang','airport','✈️'],['은행','eunhaeng','bank','🏦'],['극장','geukjang','theater','🎬'],['역','yeok','station','🚉'],['호텔','hotel','hotel','🏨']]},
 {id:'time',group:'Everyday words',title:'Days & Weather',emoji:'🌤️',
  tip:'Days, seasons and weather. Short words — perfect for building a steady rhythm.',
  items:[['오늘','oneul','today','📅'],['내일','naeil','tomorrow','➡️'],['어제','eoje','yesterday','⬅️'],['아침','achim','morning','🌅'],['저녁','jeonyeok','evening','🌇'],['하늘','haneul','sky','☁️'],['별','byeol','star','⭐'],['달','dal','moon','🌙'],['바람','baram','wind','🍃'],['눈','nun','snow','❄️'],['비','bi','rain','🌧️'],['시간','sigan','time','⏰'],['여름','yeoreum','summer','☀️'],['겨울','gyeoul','winter','⛄'],['가을','gaeul','autumn','🍂'],['봄','bom','spring','🌸']]},
 {id:'feelings',group:'Everyday words',title:'Feelings',emoji:'💖',
  tip:'How are you feeling? Many of these end in 요 — the polite ending you hear everywhere. Easy to type: ㅇ then ㅛ!',
  items:[['행복해요','haengbokhaeyo','I\'m happy','😊'],['슬퍼요','seulpeoyo','I\'m sad','😭'],['졸려요','jollyeoyo','I\'m sleepy','😴'],['배고파요','baegopayo','I\'m hungry','🤤'],['피곤해요','pigonhaeyo','I\'m tired','😩'],['보고싶어요','bogosipeoyo','I miss you','🥺'],['사랑','sarang','love','💗'],['웃음','useum','laughter','😆'],['기분','gibun','mood','🙂'],['친절해요','chinjeolhaeyo','kind','🤗'],['행복','haengbok','happiness','🌈']]},
 {id:'shift',group:'Power-ups',title:'Shift Magic',emoji:'⭐',
  tip:'Power-up! Hold Shift + Q W E R T for the "double" consonants ㅃ ㅉ ㄸ ㄲ ㅆ, and Shift + O / P for ㅒ ㅖ. Only those keys change.',
  items:[['아빠','appa','dad','👨'],['오빠','oppa','older brother (to a girl)','👦'],['토끼','tokki','rabbit','🐰'],['꽃','kkot','flower','🌸'],['딸기','ttalgi','strawberry','🍓'],['빵','ppang','bread','🍞'],['쌀','ssal','uncooked rice','🌾'],['예뻐요','yeppeoyo','pretty','🌷'],['떡볶이','tteokbokki','spicy rice cakes','🌶️'],['짜장면','jajangmyeon','black bean noodles','🍝'],['까치','kkachi','magpie','🐦'],['얘기','yaegi','story / chat','💬'],['찌개','jjigae','stew','🍲'],['맛있어요','masisseoyo','delicious','😋']]},
 {id:'compound',group:'Power-ups',title:'Compound Vowels',emoji:'🌈',
  tip:'Some vowels are typed as two vowels in a row: ㅗ+ㅏ = ㅘ, ㅜ+ㅓ = ㅝ, ㅜ+ㅣ = ㅟ, ㅡ+ㅣ = ㅢ, ㅗ+ㅣ = ㅚ, ㅗ+ㅐ = ㅙ.',
  items:[['사과','sagwa','apple','🍎'],['과자','gwaja','snack','🍪'],['귀여워요','gwiyeowoyo','cute!','🥰'],['고마워요','gomawoyo','thanks','🙏'],['회사','hoesa','company','🏢'],['의사','uisa','doctor','🧑‍⚕️'],['의자','uija','chair','🪑'],['화이팅','hwaiting','you can do it!','💪'],['와','wa','wow','😲'],['뭐','mwo','what','❓'],['왜','wae','why','🤔'],['전화','jeonhwa','phone call','📞'],['병원','byeongwon','hospital','🏥'],['공원','gongwon','park','🌳'],['도서관','doseogwan','library','📚'],['취미','chwimi','hobby','🎨']]},
 {id:'double',group:'Power-ups',title:'Double Finals',emoji:'🍰',
  tip:'The final boss! Some blocks end in TWO consonants, like ㄺ (ㄹ + ㄱ). Just type them one after the other.',
  items:[['읽어요','ilgeoyo','I read','📖'],['없어요','eopseoyo','there isn\'t','🚫'],['앉아요','anjayo','I sit','🪑'],['닭고기','dakgogi','chicken meat','🍗'],['값','gap','price','💰'],['삶','salm','life','🌱'],['괜찮아요','gwaenchanayo','it\'s okay','👌'],['많아요','manayo','there\'s a lot','🎈'],['넓어요','neolbeoyo','it\'s wide','🏞️'],['맑아요','malgayo','it\'s clear','🌤️']]},
 {id:'phrases',group:'Real sentences',title:'Real Phrases',emoji:'💬',
  tip:'The real deal: full phrases! Press the Space bar between words — it\'s the long key at the bottom.',
  items:[['만나서 반가워요','mannaseo bangawoyo','nice to meet you','🤝'],['저는 학생이에요','jeoneun haksaengieyo','I am a student','🎓'],['물 주세요','mul juseyo','water, please','💧'],['커피 한 잔 주세요','keopi han jan juseyo','a coffee, please','☕'],['잘 지내요','jal jinaeyo','how are you?','😊'],['저도 좋아요','jeodo joayo','me too, I like it','👍'],['사랑해요 엄마','saranghaeyo eomma','I love you, mom','💕'],['한국어 공부','hangugeo gongbu','Korean study','📚'],['오늘 뭐 해요','oneul mwo haeyo','what are you doing today?','🗓️'],['이거 얼마예요','igeo eolmayeyo','how much is this?','💰'],['보고 싶어요','bogo sipeoyo','I miss you','🥺'],['맛있어요 감사합니다','masisseoyo gamsahamnida','delicious, thank you','😋']]},
 {id:'travel',group:'Sentence Studio',title:'Travel Talk',emoji:'✈️',
  tip:'Useful phrases for restaurants, shops and getting around Korea. You\'ll use these for real!',
  items:[['메뉴판 좀 주세요','menyupan jom juseyo','Menu, please','📋'],['물 한 잔 더 주세요','mul han jan deo juseyo','One more glass of water, please','💧'],['화장실이 어디예요','hwajangsiri eodiyeyo','Where is the bathroom?','🚻'],['지하철역이 어디에 있어요','jihacheolyeogi eodie isseoyo','Where is the subway station?','🚇'],['이 버스 서울에 가요','i beoseu seoure gayo','Does this bus go to Seoul?','🚌'],['예약을 했어요','yeyageul haesseoyo','I made a reservation','📅'],['사진 좀 찍어 주세요','sajin jom jjigeo juseyo','Please take a photo for me','📷'],['영어 할 수 있어요','yeongeo hal su isseoyo','I can speak English','🗣️'],['여기 앉아도 돼요','yeogi anjado dwaeyo','May I sit here?','🪑'],['계산서 주세요','gyesanseo juseyo','The check, please','🧾'],['너무 비싸요 깎아 주세요','neomu bissayo kkakka juseyo','Too expensive, discount please','💸'],['길을 잃었어요','gireul ireosseoyo','I\'m lost','🧭']]},
 {id:'chat',group:'Sentence Studio',title:'Daily Chat',emoji:'💬',
  tip:'Time to chat! A sentence is just words with the Space bar between them. Find a steady rhythm: type, space, type, space.',
  items:[['안녕하세요 만나서 반갑습니다','annyeonghaseyo mannaseo bangapseumnida','Hello, nice to meet you','🤝'],['오늘 날씨가 정말 좋아요','oneul nalssiga jeongmal joayo','The weather is really nice today','☀️'],['저는 한국어를 공부해요','jeoneun hangugeoreul gongbuhaeyo','I study Korean','📚'],['지금 뭐 하고 있어요','jigeum mwo hago isseoyo','What are you doing now?','🤔'],['주말에 친구를 만나요','jumare chingureul mannayo','I meet a friend on the weekend','🧑‍🤝‍🧑'],['이 커피 정말 맛있어요','i keopi jeongmal masisseoyo','This coffee is really delicious','☕'],['내일 같이 영화 봐요','naeil gachi yeonghwa bwayo','Let\'s watch a movie together tomorrow','🎬'],['배가 고파서 밥을 먹어요','baega gopaseo babeul meogeoyo','I\'m hungry, so I\'m eating','🍚'],['한국 음식을 좋아해요','hanguk eumsigeul joahaeyo','I like Korean food','🍜'],['오늘 정말 즐거웠어요','oneul jeongmal jeulgeowosseoyo','Today was really fun','🎉'],['저는 매일 커피를 마셔요','jeoneun maeil keopireul masyeoyo','I drink coffee every day','☕']]},
 {id:'stories',group:'Sentence Studio',title:'Stories & Plans',emoji:'📖',
  tip:'Longer sentences with past tense, plans and reasons. Watch for 았 / 었 / 했 endings — they use the ㅆ Shift key!',
  items:[['어제 친구랑 같이 영화를 봤어요','eoje chingurang gachi yeonghwareul bwasseoyo','Yesterday I watched a movie with a friend','🎬'],['저는 매일 아침 일곱 시에 일어나요','jeoneun maeil achim ilgop sie ireonayo','I wake up at seven every morning','⏰'],['비가 와서 집에 있었어요','biga waseo jibe isseosseoyo','It rained, so I stayed home','🌧️'],['주말에 가족과 함께 여행을 갔어요','jumare gajokgwa hamkke yeohaengeul gasseoyo','I traveled with my family on the weekend','✈️'],['한국 드라마를 보면서 한국어를 배워요','hanguk deuramareul bomyeonseo hangugeoreul baewoyo','I learn Korean by watching K-dramas','📺'],['시간이 없어서 택시를 탔어요','sigani eopseoseo taeksireul tasseoyo','I had no time, so I took a taxi','🚕'],['저는 고양이를 키우고 싶어요','jeoneun goyangireul kiugo sipeoyo','I want to raise a cat','🐱'],['열심히 연습하면 잘할 수 있어요','yeolsimhi yeonseupamyeon jalhal su isseoyo','If you practice hard, you can do well','💪'],['제가 좋아하는 계절은 봄이에요','jega joahaneun gyejeoreun bomieyo','My favorite season is spring','🌸'],['꿈을 이루기 위해 노력할 거예요','kkumeul irugi wihae noryeokal geoyeyo','I will work hard to achieve my dream','🌟']]},
 {id:'culture',group:'Sentence Studio',title:'Culture & Opinions',emoji:'🎎',
  tip:'Long, natural sentences about Korean culture and your own opinions — and there are even more packs after this! Take a breath between words — accuracy first, speed follows.',
  items:[['한글은 세종대왕이 만든 문자예요','hangeureun sejongdaewangi mandeun munjayeyo','Hangul is a script made by King Sejong','👑'],['케이팝 콘서트에 가 보고 싶어요','keipap konseoteue ga bogo sipeoyo','I want to go to a K-pop concert','🎤'],['김치는 매운데 정말 맛있어요','gimchineun maeunde jeongmal masisseoyo','Kimchi is spicy but really delicious','🌶️'],['한국어를 배우면 한국 친구를 사귈 수 있어요','hangugeoreul baeumyeon hanguk chingureul sagwil su isseoyo','If you learn Korean, you can make Korean friends','🫶'],['저는 서울의 맛집을 찾아다니는 걸 좋아해요','jeoneun seourui matjibeul chajadaneuneun geol joahaeyo','I love hunting for tasty places in Seoul','🍽️'],['주말에는 보통 집에서 쉬거나 책을 읽어요','jumareneun botong jibeseo swigeona chaegeul ilgeoyo','On weekends I usually rest at home or read','📖'],['어렸을 때부터 한국 노래를 좋아했어요','eoryeosseul ttaebuteo hanguk noraereul joahaesseoyo','I\'ve liked Korean songs since I was little','🎵'],['아무리 바빠도 매일 연습하면 실력이 늘어요','amuri bappado maeil yeonseupamyeon sillyeogi neureoyo','However busy you are, daily practice builds skill','📈'],['비가 오는 날에는 따뜻한 차가 마시고 싶어요','biga oneun nareneun ttatteutan chaga masigo sipeoyo','On rainy days I want some warm tea','🍵'],['여러분의 도움 덕분에 정말 많이 배웠어요','yeoreobunui doum deokbune jeongmal mani baewosseoyo','Thanks to your help, I learned so much','🙏'],['저는 한국에서 살아 보는 것이 꿈이에요','jeoneun hangugeseo sara boneun geosi kkumieyo','Living in Korea is my dream','🏙️']]},
 {id:'work',group:'Sentence Studio',title:'Work & School',emoji:'💼',
  tip:'Office and campus talk: meetings, deadlines and study plans. Sentences are getting longer, so keep a steady rhythm between spaces.',
  items:[['저는 회사에서 일하고 동생은 대학교에 다녀요','jeoneun hoesaeseo ilhago dongsaengeun daehakgyoe danyeoyo','I work at a company and my younger sibling attends university','💼'],['내일 아침 아홉 시에 중요한 회의가 있어요','naeil achim ahop sie jungyohan hoeuiga isseoyo','I have an important meeting at nine tomorrow morning','📅'],['시험 공부를 하느라고 어젯밤에 잠을 못 잤어요','siheom gongbureul haneurago eojetbame jameul mot jasseoyo','I couldn\'t sleep last night because I was studying for the exam','😴'],['선생님께서 숙제를 내일까지 내라고 하셨어요','seonsaengnimkkeseo sukjereul naeilkkaji naerago hasyeosseoyo','The teacher told us to hand in the homework by tomorrow','📝'],['이번 주말에 도서관에서 같이 공부할래요','ibeon jumare doseogwaneseo gachi gongbuhallaeyo','Shall we study together at the library this weekend?','📚'],['점심시간에 동료들과 함께 식당에 갔어요','jeomsimsigane dongnyodeulgwa hamkke sikdange gasseoyo','At lunchtime I went to a restaurant with my colleagues','🍱'],['발표 준비가 끝나서 이제 조금 편하게 쉴 수 있어요','balpyo junbiga kkeutnaseo ije jogeum pyeonhage swil su isseoyo','The presentation prep is done, so I can finally rest a little','🎤'],['새로운 프로젝트 때문에 요즘 매일 늦게까지 일해요','saeroun peurojekteu ttaemune yojeum maeil neutgekkaji ilhaeyo','Because of the new project I work late every day lately','💻'],['영어로 이메일을 쓰는 것이 아직 조금 어려워요','yeongeoro imeireul sseuneun geosi ajik jogeum eoryeowoyo','Writing emails in English is still a little hard','✉️'],['졸업하면 해외에서 일해 보고 싶어요','joreophamyeon haeoeeseo ilhae bogo sipeoyo','When I graduate I want to try working overseas','🌏']]},
 {id:'friends',group:'Sentence Studio',title:'Friends & Feelings',emoji:'💞',
  tip:'Say what\'s in your heart! Thanks, apologies and happy memories — with lots of ㅆ and compound vowels hiding inside.',
  items:[['친구가 생일 선물로 예쁜 꽃을 사 줘서 정말 고마웠어요','chinguga saengil mullo yeppeun kkocheul sa jwoseo jeongmal gomawosseoyo','My friend bought me pretty flowers for my birthday and I was really thankful','💐'],['요즘 너무 힘들었는데 네가 옆에 있어 줘서 큰 힘이 됐어요','yojeum neomu himdeureonneunde nega yeope isseo jwoseo keun himi dwaesseoyo','I\'ve had a hard time lately, but having you beside me gave me great strength','🤗'],['오랜만에 고등학교 친구들을 만나서 밤새도록 이야기했어요','oraenmane godeunghakgyo chingudeureul mannaseo bamsaedorok iyagihaesseoyo','I met my high school friends after a long time and we talked all night','🌙'],['약속 시간에 늦어서 정말 미안해요 다음에는 일찍 올게요','yaksok sigane neujeoseo jeongmal mianhaeyo daeumeneun iljjik olgeyo','I\'m so sorry I was late; I\'ll come early next time','🙏'],['네가 웃으면 나도 모르게 기분이 좋아져요','nega useumyeon nado moreuge gibuni joajyeoyo','When you smile, I can\'t help feeling happy','😊'],['처음에는 낯설었지만 지금은 우리 모두 가장 친한 친구예요','cheoeumeneun natseoreotjiman jigeumeun uri modu gajang chinhan chinguyeyo','At first it felt strange, but now we\'re all the closest of friends','👭'],['슬플 때는 혼자 있지 말고 나한테 전화해 주세요','seulpeul ttaeneun honja itji malgo nahante jeonhwahae juseyo','When you\'re sad, don\'t stay alone — call me','📞'],['그 영화를 보고 나서 한참 동안 눈물이 멈추지 않았어요','geu yeonghwareul bogo naseo hanchamdongan nunmuri meomchuji anasseoyo','After watching that movie, my tears wouldn\'t stop for a long while','😭'],['우리가 처음 만난 날을 아직도 또렷하게 기억해요','uriga cheoeum mannan nareul ajikdo ttoreotage gieokhaeyo','I still remember the day we first met very clearly','💭'],['앞으로도 오랫동안 서로에게 좋은 친구가 되고 싶어요','apeurodo oraetdongan seoroege joeun chinguga doego sipeoyo','I want to stay good friends with each other for a long time','💞']]},
 {id:'health',group:'Sentence Studio',title:'Health & Habits',emoji:'🧘',
  tip:'Daily routines and healthy living. Watch for the tricky double finals like ㄶ and ㄼ inside longer sentences.',
  items:[['건강을 위해서 매일 아침 삼십 분씩 공원에서 걷고 있어요','geongangeul wihaeseo maeil achim samsip bunssik gongwoneseo geotgo isseoyo','For my health I walk in the park for thirty minutes every morning','🚶'],['감기에 걸려서 따뜻한 차를 마시고 일찍 잠자리에 들었어요','gamgie geollyeoseo ttatteuthan chareul masigo iljjik jamjarie deureosseoyo','I caught a cold, so I drank warm tea and went to bed early','🍵'],['의사 선생님께서 하루에 물을 여덟 잔 이상 마시라고 말씀하셨어요','uisa seonsaengnimkkeseo harue mureul yeodeol jan isang masirago malsseumhasyeosseoyo','The doctor told me to drink at least eight glasses of water a day','💧'],['요즘 운동을 시작했더니 몸이 훨씬 가벼워진 것 같아요','yojeum undongeul sijakhaetdeoni momi hwolssin gabyeowojin geot gatayo','Since I started exercising, my body feels much lighter','🏃'],['밤늦게 라면을 먹으면 다음 날 얼굴이 붓기 때문에 참고 있어요','bamneutge ramyeoneul meogeumyeon daeum nal eolguri butgi ttaemune chamgo isseoyo','Late-night ramen puffs up my face, so I\'m holding back','🍜'],['스트레스를 풀려고 좋아하는 음악을 들으면서 천천히 산책했어요','seuteureseureul pullyeogo joahaneun eumageul deureumyeonseo cheoncheonhi sanchaekhaesseoyo','To relieve stress I took a slow walk listening to my favorite music','🎧'],['아침을 꼭 먹어야 하루 종일 힘이 나요','achimeul kkok meogeoya haru jongil himi nayo','I have to eat breakfast to have energy all day','🍳'],['눈이 아플 때는 잠깐 멀리 있는 나무를 바라보세요','nuni apeul ttaeneun jamkkan meolli inneun namureul baraboseyo','When your eyes hurt, look at a faraway tree for a moment','🌳'],['한 달 동안 설탕을 줄였더니 피부가 눈에 띄게 좋아졌어요','han dal dongan seoltangeul jul-yeotdeoni pibuga nune ttuige joajyeosseoyo','After cutting sugar for a month, my skin visibly improved','✨'],['매일 조금씩이라도 꾸준히 하는 것이 가장 중요해요','maeil jogeumssigirado kkujunhi haneun geosi gajang jungyohaeyo','Doing a little consistently every day matters most','🌱']]},
 {id:'dreams',group:'Sentence Studio',title:'Dreams & Goals',emoji:'🌠',
  tip:'Talk about your dreams, plans and hopes. Longer sentences with reasons and wishes — you\'ve got this!',
  items:[['저는 어릴 때부터 세계 여행을 하면서 책을 쓰는 것이 꿈이었어요','jeoneun eoril ttaebuteo segye yeohaengeul hamyeonseo chaegeul sseuneun geosi kkumieosseoyo','Since I was little, my dream has been to write books while traveling the world','🌍'],['올해 안에 한국어 능력 시험 이 급에 합격하는 것이 목표예요','olhae ane hangugeo neungnyeok siheom i geube hapgyeokhaneun geosi mokpyoyeyo','My goal is to pass TOPIK level 2 this year','🎯'],['열심히 노력하면 언젠가 꼭 이루어질 거라고 믿어요','yeolsimhi noryeokhamyeon eonjenga kkok irueojil georago mideoyo','I believe that if I work hard it will surely come true someday','🌟'],['내년 봄에는 서울에서 한 달 동안 어학연수를 받을 계획이에요','naenyeon bomeneun seoureseo han dal dongan eohangnyeonsureul badeul gyehoegieyo','Next spring I plan to take a month-long language course in Seoul','🏙️'],['한국 친구들과 통역 없이 자유롭게 대화할 수 있으면 좋겠어요','hanguk chingudeulgwa tongyeok eopsi jayuropge daehwahal su isseumyeon jokesseoyo','I hope I can chat freely with Korean friends without an interpreter','💬'],['실수를 두려워하지 않고 계속 도전하는 사람이 되고 싶어요','silsureul duryeowohaji anko gyesok dojeonhaneun sarami doego sipeoyo','I want to be someone who keeps trying without fearing mistakes','💪'],['작은 습관들이 모이면 결국 큰 변화를 만들어 낼 수 있어요','jageun seupgwandeuri moimyeon gyeolguk keun byeonhwareul mandeureo nael su isseoyo','Small habits add up and in the end create big change','🦋'],['돈을 모아서 부모님께 작은 집을 선물해 드리고 싶어요','doneul moaseo bumonimkke jageun jibeul seonmulhae deurigo sipeoyo','I want to save money and give my parents a little house','🏡'],['포기하고 싶은 순간마다 처음 시작했던 이유를 떠올려요','pogihago sipeun sunganmada cheoeum sijakhaetdeon iyureul tteoollyeoyo','Every time I want to give up, I recall why I started','🔥'],['일 년 전에는 한글도 못 읽었는데 이제는 직접 문장을 칠 수 있어요','il nyeon jeoneneun hangeuldo mot ilgeonneunde ijeneun jikjeop munjangeul chil su isseoyo','A year ago I couldn\'t even read Hangul, but now I can type sentences myself','⌨️']]},
 {id:'korea',group:'Sentence Studio',title:'Living in Korea',emoji:'🏙️',
  tip:'Everyday life and culture in Korea: transport, manners, festivals and food. Real-world sentences at a natural pace.',
  items:[['지하철에서 내려서 오 번 출구로 나가면 편의점이 바로 보여요','jihacheoreseo naeryeoseo o beon chulguro nagamyeon pyeonuijeomi baro boyeoyo','Get off the subway and take exit 5; you\'ll see a convenience store right away','🚉'],['한국에서는 식당에서 밥을 먹을 때 어른이 먼저 수저를 드는 것이 예의예요','hangugeseoneun sikdangeseo babeul meogeul ttae eoreuni meonjeo sujeoreul deuneun geosi yeuiyeyo','In Korea it\'s polite to wait for elders to pick up their spoon first','🥄'],['겨울에는 온돌 바닥이 따뜻해서 방에서 나오기가 싫어져요','gyeoureneun ondol badagi ttatteutaeseo bangeseo naogiga sireojyeoyo','In winter the ondol floor is so warm I don\'t want to leave the room','🛋️'],['택배는 보통 주문한 다음 날 아침에 문 앞에 도착해요','taekbaeneun botong jumunhan daeum nal achime mun ape dochakhaeyo','Parcels usually arrive at your door the morning after you order','📦'],['추석에는 온 가족이 모여서 송편을 빚고 보름달을 구경해요','chuseogeneun on gajogi moyeoseo songpyeoneul bitgo boreumdareul gugyeonghaeyo','At Chuseok the whole family gathers to shape songpyeon and enjoy the full moon','🌕'],['카페에서 공부하는 사람이 많아서 주말에는 자리를 찾기가 어려워요','kapeeseo gongbuhaneun sarami manaseo jumareneun jarireul chatgiga eoryeowoyo','Many people study in cafes, so seats are hard to find on weekends','☕'],['처음 만나는 사람에게는 존댓말을 쓰는 것이 기본 예절이에요','cheoeum mannaneun saramegeneun jondaenmareul sseuneun geosi gibon yejeorieyo','Using polite speech with people you meet for the first time is basic manners','🙇'],['비가 많이 오는 장마철에는 우산을 꼭 챙겨 다녀야 해요','biga mani oneun jangmacheoreneun usaneul kkok chaenggyeo danyeoya haeyo','In the rainy season you must carry an umbrella with you','☔'],['한강 공원에서 치킨을 시켜 먹는 것은 서울 사람들의 즐거운 문화예요','hangang gongwoneseo chikineul sikyeo meongneun geoseun seoul saramdeurui jeulgeoun munhwayeyo','Ordering fried chicken at Han River park is a fun Seoul tradition','🍗'],['노래방에서 친구들과 신나게 노래를 부르면 스트레스가 확 풀려요','noraebangeseo chingudeulgwa sinnage noraereul bureumyeon seuteureseuga hwak pullyeoyo','Singing with friends at karaoke melts stress away','🎤']]},
 {id:'master',group:'Sentence Studio',title:'Master Class',emoji:'🏆',
  tip:'The true grand finale! Very long, flowing sentences. Stay calm, keep your eyes on the words, and let your fingers find the rhythm.',
  items:[['어제 비가 너무 많이 와서 약속을 취소했지만 오늘은 날씨가 맑아서 친구와 한강에서 자전거를 탔어요','eoje biga neomu mani waseo yaksogeul chwisohaetjiman oneureun nalssiga malgaseo chinguwa hangangeseo jajeongeoreul tasseoyo','Yesterday I cancelled plans because of heavy rain, but today it was clear so I rode bikes with a friend by the Han River','🚲'],['한국어를 배우기 시작한 지 벌써 일 년이 지났는데 아직도 새로운 단어를 배울 때마다 설레요','hangugeoreul baeugi sijakhan ji beolsseo il nyeoni jinatneunde ajikdo saeroun daneoreul baeul ttaemada seolleyo','It\'s been a year since I started learning Korean, and I still get excited by every new word','📖'],['만약에 내일 시간이 괜찮으시다면 점심을 같이 먹으면서 이번 계획에 대해서 이야기해 보면 좋겠습니다','manyage naeil sigani gwaenchanheusidamyeon jeomsimeul gachi meogeumyeonseo ibeon gyehoege daehaeseo iyagihae bomyeon jokesseumnida','If you\'re free tomorrow, I\'d love to talk about this plan over lunch','🍽️'],['비록 발음이 완벽하지는 않지만 매일 조금씩 연습하다 보면 분명히 자연스러워질 거예요','birok bareumi wanbyeokhajineun anjiman maeil jogeumssik yeonseupada bomyeon bunmyeonghi jayeonseureowojil geoyeyo','Though your pronunciation isn\'t perfect, with a bit of daily practice it\'ll surely become natural','🗣️'],['제가 가장 좋아하는 계절은 가을인데 단풍이 물든 산길을 따라 천천히 걷다 보면 마음이 편안해져요','jega gajang joahaneun gyejeoreun gaeurinde danpungi muldeun sangireul ttara cheoncheonhi geotda bomyeon maeumi pyeonanhaejyeoyo','My favorite season is autumn; walking slowly along a mountain path of colored leaves calms my mind','🍁'],['이 책에는 한국의 역사와 전통문화가 쉬운 말로 재미있게 설명되어 있어서 초보자도 쉽게 읽을 수 있어요','i chaegeneun hangugui yeoksawa jeontongmunhwaga swiun mallo jaemiitge seolmyeongdoeeo isseoseo chobojado swipge ilgeul su isseoyo','This book explains Korean history and culture in easy, fun language so even beginners can read it','📚'],['아무리 바빠도 가족과 함께 저녁을 먹는 시간만큼은 꼭 지키려고 노력하고 있어요','amuri bappado gajokgwa hamkke jeonyeogeul meongneun siganmankeumeun kkok jikilyeogo noryeokago isseoyo','However busy I am, I try hard to protect the time for dinner with my family','👨‍👩‍👧'],['외국어를 배우는 가장 좋은 방법은 틀려도 부끄러워하지 말고 용기 내어 계속 말해 보는 거라고 생각해요','oegugeoreul baeuneun gajang joeun bangbeobeun teullyeodo bukkeureowohaji malgo yonggi naeeo gyesok malhae boneun georago saenggakhaeyo','I think the best way to learn a language is to keep speaking courageously without being embarrassed by mistakes','🦁'],['오늘 아침에 일어나 보니 창밖에 첫눈이 소복소복 내리고 있어서 너무 행복했어요','oneul achime ireona boni changbakke cheonnuni soboksobok naerigo isseoseo neomu haengbokhaesseoyo','This morning I woke to the first snow falling softly outside my window and felt so happy','❄️'],['여러분이 여기까지 열심히 따라와 주셔서 정말 감사드리며 앞으로도 한글 타자 실력이 더욱 빠르고 정확해지기를 응원합니다','yeoreobuni yeogikkaji yeolsimhi ttarawa jusyeoseo jeongmal gamsadeurimyeo apeurodo hangeul taja sillyeogi deouk ppareugo jeonghwakhaejigireul eungwonhamnida','Thank you so much for coming this far; we cheer you on to even faster, more accurate Hangul typing','🏆']]},
];

// ---------- placement test: 7 stages, each needs 2 words typed with no hints ----------
// start = index of the lesson to recommend if the learner fails this stage
const PLACE=[
 {name:'Basic keys',limit:30,start:0,words:[['엄마','eomma','mom','👩'],['가족','gajok','family','👨‍👩‍👧']]},
 {name:'All the letters',limit:35,start:2,words:[['컴퓨터','keompyuteo','computer','💻'],['아이스크림','aiseukeurim','ice cream','🍦']]},
 {name:'Shift keys',limit:35,start:8,words:[['아빠','appa','dad','👨'],['떡볶이','tteokbokki','spicy rice cakes','🌶️']]},
 {name:'Compound vowels',limit:35,start:9,words:[['사과','sagwa','apple','🍎'],['귀여워요','gwiyeowoyo','cute!','🥰']]},
 {name:'Double finals',limit:40,start:10,words:[['읽어요','ilgeoyo','I read','📖'],['괜찮아요','gwaenchanayo','it\'s okay','👌']]},
 {name:'Phrases',limit:45,start:11,words:[['물 주세요','mul juseyo','water, please','💧'],['저는 학생이에요','jeoneun haksaengieyo','I am a student','🎓']]},
 {name:'Sentences',limit:60,start:12,words:[['오늘 날씨가 정말 좋아요','oneul nalssiga jeongmal joayo','The weather is really nice today','☀️'],['어제 친구랑 같이 영화를 봤어요','eoje chingurang gachi yeonghwareul bwasseoyo','Yesterday I watched a movie with a friend','🎬']]}
];
const PLACE_PASSED_ALL=14;   // lesson to recommend if every stage is passed
const PLEVELS=[['Fresh Sprout','🌱'],['Tiny Bunny','🐰'],['Happy Kitten','🐱'],['Sparkle Star','⭐'],['Rainbow Unicorn','🦄'],['Dream Cloud','☁️'],['Sentence Star','🌟'],['Cloud Queen','👑']];
const speedPool=(level)=> (level==='easy' ? LESSONS.slice(0,8) : level==='sent' ? LESSONS.slice(11) : LESSONS.slice(0,11)).flatMap(l=>l.items);

// ---------- key practice (memorise where each key lives) ----------
const ROWS=[['Q','W','E','R','T','Y','U','I','O','P'],['A','S','D','F','G','H','J','K','L'],['Z','X','C','V','B','N','M']];
const KSETS=[
 {id:'home',name:'Home row',emoji:'🏠',keys:['ㅁ','ㄴ','ㅇ','ㄹ','ㅎ','ㅗ','ㅓ','ㅏ','ㅣ']},
 {id:'top',name:'Top row',emoji:'⬆️',keys:['ㅂ','ㅈ','ㄷ','ㄱ','ㅅ','ㅛ','ㅕ','ㅑ','ㅐ','ㅔ']},
 {id:'bottom',name:'Bottom row',emoji:'⬇️',keys:['ㅋ','ㅌ','ㅊ','ㅍ','ㅠ','ㅜ','ㅡ']},
 {id:'shift',name:'Shift keys',emoji:'⭐',keys:['ㅃ','ㅉ','ㄸ','ㄲ','ㅆ','ㅒ','ㅖ']},
 {id:'all',name:'All keys',emoji:'🌈',keys:KEYORDER.slice()}
];
// exact spot on the keyboard, e.g. "top row · 3rd from left" (unique for every key)
function locDesc(code){
  const L=code.slice(3),ri=ROWS.findIndex(r=>r.includes(L)),row=ROWS[ri],i=row.indexOf(L),n=row.length;
  const ord=k=>k+(['th','st','nd','rd'][(k%100>10&&k%100<14)?0:Math.min(k%10,4)%4]||'th');
  const side=i===0?'far left':n-i===1?'far right':i<n/2?ord(i+1)+' from left':ord(n-i)+' from right';
  return ['top','middle','bottom'][ri]+' row · '+side;
}
// how well do you know a key? stat = {n: attempts, miss: attempts needing a retry}
function masteryOf(s){
  if(!s||!s.n)return 'none';
  const acc=1-s.miss/s.n;
  return (s.n>=2&&acc>=.9)?'good':acc>=.6?'ok':'weak';
}
const promptCount=n=>n<=4?12:n<=10?n*2:30;
// every key once (shuffled), then extra rounds weighted towards keys you miss / haven't met
function buildPrompts(keys,stats,count,rnd=Math.random){
  const w=j=>{const s=stats[j];return(!s||!s.n)?2.5:1+4*(s.miss/s.n);};
  const first=keys.slice();
  for(let i=first.length-1;i>0;i--){const k=Math.floor(rnd()*(i+1));[first[i],first[k]]=[first[k],first[i]];}
  const out=first.slice(0,count);
  while(out.length<count){
    const tot=keys.reduce((a,j)=>a+w(j),0);let r=rnd()*tot,pick=keys[keys.length-1];
    for(const j of keys){r-=w(j);if(r<=0){pick=j;break;}}
    if(keys.length>1&&pick===out[out.length-1])continue;
    out.push(pick);
  }
  return out;
}
// ===================== ENGINE END =====================
