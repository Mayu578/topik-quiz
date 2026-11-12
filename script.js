/* 設定は各HTML（korean.html / english.html）の window.QUIZ に書きます */
const CONFIG=window.QUIZ||{};
document.title=CONFIG.TITLE||document.title;
/* 動作確認用の最小サンプル（CSVを読み込むと置き換わります） */
const SAMPLE_Q=`No.,出典,種類,問題文（韓国語）,①,②,③,④,正解番号,正解の選択肢,解説,日本語訳
1,サンプル,穴埋め,"무지개는 빛이 공기 중의 물방울을 통과할 때 굴절되어 나타난다. 이때 （　） 않으면 무지개가 만들어지기 어렵다.",해가 뜨지,비가 그치지,빛이 약하지,공기가 깨끗하지,4,공기가 깨끗하지,後ろの理由から、空気がきれいでないと虹ができにくい。,虹は光が水滴で屈折して現れる。（空気がきれいで）ないと虹はできにくい。`;
const SAMPLE_W=`韓国語,日本語,出典（問題）,種類
굴절되다,屈折する,サンプル,穴埋め
물방울,水滴,サンプル,穴埋め`;

const $=id=>document.getElementById(id), app=$('app'), MARK='①②③④';
let ALL=[],WORDS={},pool,i,score,wrong,locked;

/* CSVパーサ（引用符・改行入りセルに対応） */
function parseCSV(t){
  const rows=[];let r=[],c='',q=false;
  t=t.replace(/^\uFEFF/,'');
  for(let k=0;k<t.length;k++){
    const ch=t[k];
    if(q){ if(ch=='"'){ if(t[k+1]=='"'){c+='"';k++} else q=false } else c+=ch }
    else if(ch=='"') q=true;
    else if(ch==','){r.push(c);c=''}
    else if(ch=='\n'||ch=='\r'){ if(ch=='\r'&&t[k+1]=='\n')k++; r.push(c);c='';rows.push(r);r=[] }
    else c+=ch;
  }
  if(c!==''||r.length){r.push(c);rows.push(r)}
  return rows.filter(x=>x.some(v=>v.trim()!==''));
}
function toObjects(rows){
  const h=rows[0].map(s=>s.trim());
  return rows.slice(1).map(r=>Object.fromEntries(h.map((k,n)=>[k,(r[n]||'').trim()])));
}
const pick=(o,pre)=>o[Object.keys(o).find(k=>k.startsWith(pre))]||'';

function loadQuestions(text){
  /* 見出しは完全一致を優先し、なければ「含む」で探す（例：「問題文」→「韓国語の問題文」） */
  const col=(o,...ks)=>{
    for(const k of ks) if(o[k]) return o[k];
    for(const k of ks){const h=Object.keys(o).find(x=>x.includes(k));if(h&&o[h])return o[h]}
    return '';
  };
  /* 正解番号は ② でも 2 でも読める */
  const num=s=>{const m=String(s).match(/[①②③④]|\d/);if(!m)return -1;const k=MARK.indexOf(m[0]);return k>=0?k:parseInt(m[0])-1};
  /* 「文挿入」どこに入る？ → 文挿入 のように括弧と補足を除く */
  const cleanType=t=>t.replace(/[「」]/g,'').replace(/[（(].*$/,'').replace(/どこに入る[？?]?$/,'').trim();
  ALL=toObjects(parseCSV(text)).map(o=>({
    src:col(o,'出典','分野','Part'),
    type:cleanType(col(o,'種類','問題形式')),
    text:col(o,'問題文'),
    ch:['①','②','③','④'].map(m=>o['選択肢'+m]||o[m]||'').filter(Boolean),
    ans:num(o['正解番号']),
    exp:col(o,'解説'),
    ja:col(o,'日本語訳')
  })).filter(q=>q.text&&q.ch.length>1&&q.ans>=0&&q.ans<q.ch.length);
}
function loadWords(text){
  WORDS={};
  toObjects(parseCSV(text)).forEach(o=>{
    const s=o['出典（問題）'];(WORDS[s]=WORDS[s]||[]).push([o['韓国語'],o['日本語']]);
  });
}
const get=async u=>{const r=await fetch(u);if(!r.ok)throw Error(r.status);return r.text()};

async function init(){
  try{
    if(CONFIG.QUESTIONS_CSV_URL){
      loadQuestions(await get(CONFIG.QUESTIONS_CSV_URL));
      if(CONFIG.WORDS_CSV_URL) loadWords(await get(CONFIG.WORDS_CSV_URL));
    }else{ loadQuestions(SAMPLE_Q); loadWords(SAMPLE_W); }
  }catch(e){ loadQuestions(SAMPLE_Q); loadWords(SAMPLE_W);
    home('スプレッドシートを読み込めませんでした。公開設定とURLを確認してください。サンプルを表示しています。'); return }
  home();
}

function home(msg){
  const types=[...new Set(ALL.map(q=>q.type))];
  app.innerHTML=`<p class="s"><a href="index.html">← 言語の選択へ</a></p><h2>${CONFIG.TITLE||'読解クイズ'}</h2>
  ${msg?`<div class="card" style="border-color:var(--ng)">${msg}</div>`:''}
  <div class="card"><p>${ALL.length}問を読み込み済み。</p>
  <label class="s">種類</label><select id="ty"><option value="">すべて</option>${types.map(t=>`<option>${t}</option>`).join('')}</select>
  <label class="s">問題数</label><select id="nm"><option value="0">すべて</option><option>5</option><option>10</option></select>
  <button class="main" onclick="startFromHome()">始める</button></div>
  <div class="card"><b>データの読み込み</b>
  <p class="s">スプレッドシートを CSV で保存して選びます（問題一覧と単語帳を別々に）。</p>
  <label class="s">問題一覧.csv</label><input type="file" accept=".csv" onchange="pickFile(this,'q')">
  <label class="s">単語帳.csv（省略可）</label><input type="file" accept=".csv" onchange="pickFile(this,'w')"></div>`;
}
function pickFile(el,kind){
  const f=el.files[0];if(!f)return;
  f.text().then(t=>{kind=='q'?loadQuestions(t):loadWords(t);home()});
}
const shuffle=a=>{a=a.slice();for(let k=a.length-1;k>0;k--){const j=Math.random()*(k+1)|0;[a[k],a[j]]=[a[j],a[k]]}return a};
function startFromHome(){
  const t=$('ty').value,n=+$('nm').value;
  let l=ALL.filter(q=>!t||q.type==t);l=shuffle(l);if(n)l=l.slice(0,n);
  start(l);
}
function start(l){pool=l;i=0;score=0;wrong=[];show()}

function show(){
  if(i>=pool.length)return end();
  const q=pool[i];locked=false;
  /* 文挿入（㉠〜）は順番に意味があるのでシャッフルしない */
  const fixed=q.ch.every(c=>/^[\u3260-\u326F]$/.test(c.trim()));
  q.order=fixed?q.ch.map((_,k)=>k):shuffle(q.ch.map((_,k)=>k));
  app.innerHTML=`<div class="s">${i+1} / ${pool.length}　正解 ${score}</div>
  <div class="bar"><i style="width:${i/pool.length*100}%"></i></div>
  <div class="card"><span class="tag">${q.src}</span><span class="tag">${q.type}</span>
  <div class="q" style="margin-top:8px">${esc(q.text)}</div></div>
  <div id="o">${q.order.map((k,n)=>`<button class="opt" onclick="answer(${n})">${MARK[n]} ${esc(q.ch[k])}</button>`).join('')}</div>
  <div id="r"></div>`;
}
function answer(n){
  if(locked)return;locked=true;
  const q=pool[i],btn=document.querySelectorAll('#o .opt'),right=q.order.indexOf(q.ans),hit=q.order[n]==q.ans;
  btn[right].classList.add('ok');
  if(hit)score++;else{btn[n].classList.add('ng');wrong.push(q)}
  const ws=(WORDS[q.src]||[]).map(w=>`<div><b>${esc(w[0])}</b><span class="sp" onclick="say(this.dataset.t)" data-t="${esc(w[0])}">🔊</span>${esc(w[1])}</div>`).join('');
  $('r').innerHTML=`<div class="card"><b>${hit?'⭕ 正解':'❌ 不正解（正解は'+MARK[right]+'）'}</b>
  <p>${esc(q.exp)}</p>
  ${q.ja?`<div class="box"><b>日本語訳</b>\n${esc(q.ja)}</div>`:''}
  ${ws?`<div class="box w"><b>単語</b>${ws}</div>`:''}
  <button class="main" onclick="i++;show()">${i+1<pool.length?'次へ':'結果を見る'}</button></div>`;
}
function end(){
  app.innerHTML=`<h2>結果　${score} / ${pool.length}</h2><div class="card"><div class="bar"><i style="width:${score/pool.length*100}%"></i></div>
  ${wrong.length?`<button class="main" onclick="start(wrong.slice())">間違えた${wrong.length}問をやり直す</button>`:'<p>全問正解です。</p>'}
  <button class="main" onclick="home()">トップへ戻る</button></div>`;
}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function say(t){try{const u=new SpeechSynthesisUtterance(t);u.lang='ko-KR';u.rate=.8;speechSynthesis.cancel();speechSynthesis.speak(u)}catch(e){}}
init();