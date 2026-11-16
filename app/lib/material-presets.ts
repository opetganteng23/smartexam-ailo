// Template materi HTML interaktif. Admin non-teknis cukup mengubah data di bagian atas skrip.
// Semua memakai EI.report / EI.complete(skor 0-100, jawaban) untuk melaporkan hasil ke induk.
import type { HtmlDoc } from "./material-doc";

const BASE_CSS = `body{max-width:720px;margin:0 auto}h2{margin:0 0 12px;color:#0A4256}button{font:inherit;cursor:pointer}
.btn{background:#00809C;color:#fff;border:0;border-radius:10px;padding:12px 18px;font-weight:600;min-height:44px}.btn.alt{background:#fff;color:#00809C;border:1.5px solid #C3D8DE}
.card{border:1px solid #DCE8EC;border-radius:14px;padding:16px;margin:12px 0;background:#fff}.muted{color:#4F6670;font-size:14px}.ok{color:#1D6B3F;font-weight:600}.bad{color:#B3261E;font-weight:600}
input[type=text]{font:inherit;padding:8px 10px;border:1.5px solid #C3D8DE;border-radius:8px;min-width:110px}`;

export const PRESETS: { key: string; name: string; desc: string; doc: HtmlDoc }[] = [
  {
    key: "quiz", name: "Multiple-choice quiz", desc: "Questions with options A-D, score at the end.",
    doc: {
      css: BASE_CSS + `.opt{display:block;width:100%;text-align:left;margin:8px 0;padding:12px 14px;border:1.5px solid #C3D8DE;border-radius:10px;background:#fff}.opt.sel{border-color:#00809C;background:#E0F3F7}.opt.right{border-color:#1D6B3F;background:#E6F4EC}.opt.wrong{border-color:#B3261E;background:#FDECEA}`,
      html: `<h2>Quiz: Subject-Verb Agreement</h2><div id="app"></div>`,
      js: `// EDIT DATA HERE: q = question, o = options, a = index of the correct answer (starting at 0)
var DATA=[
 {q:"The results of the experiment ___ surprising.",o:["was","were","is","has been"],a:1},
 {q:"She avoided ___ the question.",o:["to answer","answering","answer","answered"],a:1},
 {q:"If I ___ more time, I would travel.",o:["have","had","will have","would have"],a:1}
];
var i=0,score=0,picked=null,answers=[],app=document.getElementById('app');
function show(){
 if(i>=DATA.length){var pct=Math.round(score/DATA.length*100);app.innerHTML='<div class="card"><h2>Done</h2><p>Your score: <b>'+score+' of '+DATA.length+'</b> ('+pct+'%).</p><button class="btn" onclick="restart()">Try again</button></div>';EI.complete(pct,answers);return;}
 var d=DATA[i];app.innerHTML='<div class="card"><p class="muted">Question '+(i+1)+' of '+DATA.length+'</p><p><b>'+d.q+'</b></p>'+d.o.map(function(t,k){return '<button class="opt" data-k="'+k+'">'+"ABCD"[k]+'. '+t+'</button>'}).join('')+'<p id="fb"></p><button class="btn" id="next" style="display:none">'+(i+1<DATA.length?'Next':'See score')+'</button></div>';
 var opts=app.querySelectorAll('.opt');opts.forEach(function(b){b.onclick=function(){if(picked!==null)return;picked=+b.dataset.k;answers.push(picked);var ok=picked===d.a;if(ok)score++;opts.forEach(function(x,k){if(k===d.a)x.classList.add('right');else if(k===picked)x.classList.add('wrong')});document.getElementById('fb').innerHTML=ok?'<span class="ok">Correct!</span>':'<span class="bad">Not quite.</span> Answer: '+"ABCD"[d.a];var n=document.getElementById('next');n.style.display='inline-block';n.onclick=function(){i++;picked=null;show()}}})}
function restart(){i=0;score=0;picked=null;answers=[];show()}
show();`,
    },
  },
  {
    key: "flashcard", name: "Flashcard", desc: "Two-sided cards; mark the ones you know.",
    doc: {
      css: BASE_CSS + `.fc{min-height:150px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:22px;font-weight:700;color:#0A4256;cursor:pointer;user-select:none}`,
      html: `<h2>Flashcard: Vocabulary</h2><div id="app"></div>`,
      js: `// EDIT DATA HERE: f = front, b = back
var DATA=[{f:"reluctant",b:"unwilling, hesitant"},{f:"adequate",b:"sufficient, enough"},{f:"hinder",b:"to obstruct, hold back"},{f:"thrive",b:"to grow strongly, flourish"}];
var i=0,flip=false,known={},app=document.getElementById('app');
function show(){var n=Object.keys(known).length;var d=DATA[i];app.innerHTML='<p class="muted">Card '+(i+1)+' of '+DATA.length+' · known: '+n+'</p><div class="card fc" id="c" tabindex="0" role="button" aria-label="Flip card">'+(flip?d.b:d.f)+'</div><p class="muted" style="text-align:center">Click the card to flip it</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn alt" id="p">Previous</button><button class="btn" id="k">I know it</button><button class="btn alt" id="n">Next</button></div>';
 var c=document.getElementById('c');c.onclick=function(){flip=!flip;show()};c.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();flip=!flip;show()}};
 document.getElementById('p').onclick=function(){i=(i-1+DATA.length)%DATA.length;flip=false;show()};document.getElementById('n').onclick=function(){i=(i+1)%DATA.length;flip=false;show()};
 document.getElementById('k').onclick=function(){known[i]=1;EI.report(Math.round(Object.keys(known).length/DATA.length*100),Object.keys(known));i=(i+1)%DATA.length;flip=false;show()}}
show();`,
    },
  },
  {
    key: "fillblank", name: "Fill in the blank", desc: "Sentences with a blank for participants to fill in.",
    doc: {
      css: BASE_CSS,
      html: `<h2>Fill in the blanks</h2><div id="app"></div><button class="btn" id="chk">Check answers</button><p id="res"></p>`,
      js: `// EDIT DATA HERE: use ___ for the blank, ans = correct answer (case-insensitive)
var DATA=[{t:"The scientists ___ the results yesterday.",ans:"published"},{t:"She is interested ___ marine biology.",ans:"in"},{t:"If it ___ tomorrow, we will stay home.",ans:"rains"}];
var app=document.getElementById('app');
app.innerHTML=DATA.map(function(d,i){return '<div class="card">'+(i+1)+'. '+d.t.replace('___','<input type="text" data-i="'+i+'" aria-label="Answer '+(i+1)+'" autocomplete="off">')+'<span id="m'+i+'"></span></div>'}).join('');
document.getElementById('chk').onclick=function(){var ok=0,ans=[];DATA.forEach(function(d,i){var v=app.querySelector('[data-i="'+i+'"]').value.trim();ans.push(v);var good=v.toLowerCase()===d.ans.toLowerCase();if(good)ok++;document.getElementById('m'+i).innerHTML=good?' <span class="ok">✓</span>':' <span class="bad">✗ ('+d.ans+')</span>'});var pct=Math.round(ok/DATA.length*100);document.getElementById('res').innerHTML='<b>Score: '+ok+' of '+DATA.length+' ('+pct+'%)</b>';EI.complete(pct,ans)};`,
    },
  },
  {
    key: "matching", name: "Matching (drag & drop)", desc: "Drag or tap each word to its match.",
    doc: {
      css: BASE_CSS + `.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.it{padding:10px 12px;margin:6px 0;border:1.5px solid #C3D8DE;border-radius:10px;background:#fff;touch-action:manipulation}.it.sel{border-color:#00809C;background:#E0F3F7}.it.done{opacity:.5}.drop{min-height:44px;padding:10px 12px;margin:6px 0;border:2px dashed #C3D8DE;border-radius:10px}.drop.good{border-color:#1D6B3F;background:#E6F4EC}`,
      html: `<h2>Match each word with its meaning</h2><p class="muted">Drag a word onto its meaning, or tap a word and then tap a box.</p><div class="row"><div id="L"></div><div id="R"></div></div><p id="res"></p>`,
      js: `// EDIT DATA HERE: w = word, m = meaning
var DATA=[{w:"reluctant",m:"unwilling"},{w:"adequate",m:"sufficient"},{w:"hinder",m:"obstruct"},{w:"thrive",m:"flourish"}];
var L=document.getElementById('L'),R=document.getElementById('R'),sel=null,got=0,tries=0;
function shuffle(a){return a.map(function(x){return [Math.random(),x]}).sort(function(p,q){return p[0]-q[0]}).map(function(p){return p[1]})}
shuffle(DATA).forEach(function(d){var e=document.createElement('div');e.className='it';e.textContent=d.w;e.draggable=true;e.dataset.w=d.w;e.onclick=function(){if(e.classList.contains('done'))return;document.querySelectorAll('.it.sel').forEach(function(x){x.classList.remove('sel')});sel=e;e.classList.add('sel')};e.ondragstart=function(ev){ev.dataTransfer.setData('text/plain',d.w);sel=e};L.appendChild(e)});
shuffle(DATA).forEach(function(d){var t=document.createElement('div');t.className='drop';t.textContent=d.m;t.dataset.w=d.w;function tryDrop(w){tries++;if(w===d.w&&!t.classList.contains('good')){t.classList.add('good');t.textContent=d.m+': '+w;got++;var el=L.querySelector('[data-w="'+w+'"]');if(el){el.classList.add('done');el.classList.remove('sel')}sel=null;if(got===DATA.length){var pct=Math.max(0,Math.round(DATA.length/tries*100));document.getElementById('res').innerHTML='<b class="ok">All matched! Attempts: '+tries+'</b>';EI.complete(pct,{tries:tries})}}else if(w!==d.w){document.getElementById('res').innerHTML='<span class="bad">Not a match, try again.</span>'}}
 t.ondragover=function(ev){ev.preventDefault()};t.ondrop=function(ev){ev.preventDefault();tryDrop(ev.dataTransfer.getData('text/plain'))};t.onclick=function(){if(sel)tryDrop(sel.dataset.w)};R.appendChild(t)});`,
    },
  },
  {
    key: "timer", name: "Practice timer", desc: "A countdown for timed reading practice per passage.",
    doc: {
      css: BASE_CSS + `.big{font-size:56px;font-weight:800;color:#0A4256;text-align:center}.late{color:#B3261E}`,
      html: `<h2>Reading practice timer</h2><p class="muted">Set the duration, read the passage, and finish before time runs out.</p><div class="card"><div class="big" id="t">11:00</div><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><label>Minutes <input type="text" id="m" value="11" size="3" inputmode="numeric" aria-label="Minutes"></label><button class="btn" id="go">Start</button><button class="btn alt" id="rs">Reset</button></div><p id="msg" class="muted" style="text-align:center"></p></div>`,
      js: `var T=document.getElementById('t'),M=document.getElementById('m'),msg=document.getElementById('msg'),left=0,iv=null,total=0;
function fmt(s){return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function set(){var m=Math.max(1,Math.min(90,parseInt(M.value,10)||11));total=m*60;left=total;T.textContent=fmt(left);T.classList.remove('late')}
document.getElementById('go').onclick=function(){if(iv)return;set();msg.textContent='Running…';iv=setInterval(function(){left--;T.textContent=fmt(Math.max(0,left));if(left<=60)T.classList.add('late');if(left<=0){clearInterval(iv);iv=null;msg.textContent='Time is up!';EI.complete(100,{minutes:total/60})}},1000)};
document.getElementById('rs').onclick=function(){clearInterval(iv);iv=null;set();msg.textContent=''};M.onchange=set;set();`,
    },
  },
  {
    key: "steps", name: "Step-by-step explanation", desc: "Reveal an explanation one step at a time, with Back and Next.",
    doc: {
      css: BASE_CSS + `.cur{border-color:#00809C;box-shadow:0 0 0 3px rgba(0,128,156,.12)}.bar{height:8px;border-radius:99px;background:#E7F0F2;margin:8px 0}.bar span{display:block;height:8px;border-radius:99px;background:#00809C}pre{background:#0f172a;color:#e2e8f0;padding:10px 12px;border-radius:10px;overflow:auto}`,
      html: `<h2>How a stack works</h2><div class="bar"><span id="bar"></span></div><div id="app"></div><p><button class="btn alt" id="bk">Back</button> <button class="btn" id="nx">Next step</button></p>`,
      js: `// EDIT DATA HERE: t = step title, b = explanation (plain text), c = optional code shown under the step
var DATA=[
 {t:"Step 1: An empty stack",b:"A stack starts empty. We only ever touch the top.",c:"top = -1"},
 {t:"Step 2: push(10)",b:"push puts a new value on top. The top index moves up by one.",c:"stack[++top] = 10"},
 {t:"Step 3: push(20)",b:"The last value in is the first value out (LIFO).",c:"stack[++top] = 20"},
 {t:"Step 4: pop()",b:"pop removes and returns the top value, here 20. The top index moves down by one.",c:"return stack[top--]"}
];
var i=0,app=document.getElementById('app'),bar=document.getElementById('bar');
function show(){app.innerHTML='';for(var k=0;k<=i;k++){var c=document.createElement('div');c.className='card'+(k===i?' cur':'');var h=document.createElement('b');h.textContent=DATA[k].t;var p=document.createElement('p');p.textContent=DATA[k].b;c.appendChild(h);c.appendChild(p);if(DATA[k].c){var pr=document.createElement('pre');pr.textContent=DATA[k].c;c.appendChild(pr)}app.appendChild(c)}
 bar.style.width=Math.round((i+1)/DATA.length*100)+'%';document.getElementById('bk').disabled=i===0;var nx=document.getElementById('nx');nx.disabled=i>=DATA.length-1;nx.textContent=i>=DATA.length-1?'All steps shown':'Next step';
 if(i>=DATA.length-1)EI.complete(100,[])}
document.getElementById('bk').onclick=function(){if(i>0){i--;show()}};document.getElementById('nx').onclick=function(){if(i<DATA.length-1){i++;show()}};show();`,
    },
  },
  {
    key: "dsviz", name: "Data structure visualizer", desc: "Try push, pop, enqueue, and dequeue and watch a stack or queue change.",
    doc: {
      css: BASE_CSS + `.cells{display:flex;gap:6px;flex-wrap:wrap;min-height:56px;align-items:center}.cell{min-width:52px;padding:12px 10px;text-align:center;border:1.5px solid #00809C;border-radius:10px;font-weight:700;background:#E7F5F8;color:#0A4256}.tag{font-size:12px;color:#4F6670;display:block}.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0}select{font:inherit;padding:8px;border:1.5px solid #C3D8DE;border-radius:8px}`,
      html: `<h2>Data structure visualizer</h2><div class="row"><label>Type <select id="kind"><option value="stack">Stack (LIFO)</option><option value="queue">Queue (FIFO)</option></select></label><input type="text" id="val" aria-label="Value" placeholder="value" maxlength="6"><button class="btn" id="add">Push</button><button class="btn alt" id="rem">Pop</button><button class="btn alt" id="clr">Clear</button></div><div class="card"><div class="cells" id="cells"></div></div><p id="msg" class="muted" role="status"></p>`,
      js: `// EDIT DATA HERE: the capacity of the structure
var CAP=8;
var items=[],kind=document.getElementById('kind'),val=document.getElementById('val'),cells=document.getElementById('cells'),msg=document.getElementById('msg'),add=document.getElementById('add'),rem=document.getElementById('rem');
function isStack(){return kind.value==='stack'}
function draw(){cells.innerHTML='';items.forEach(function(x,k){var c=document.createElement('div');c.className='cell';c.textContent=x;var t=document.createElement('span');t.className='tag';var last=k===items.length-1;t.textContent=isStack()?(last?'top':''):(k===0?'front':(last?'rear':''));c.appendChild(t);cells.appendChild(c)});if(!items.length)cells.textContent='(empty)';
 add.textContent=isStack()?'Push':'Enqueue';rem.textContent=isStack()?'Pop':'Dequeue'}
add.onclick=function(){var v=val.value.trim();if(!v){msg.textContent='Type a value first.';return}if(items.length>=CAP){msg.textContent=(isStack()?'Stack overflow':'Queue is full')+': capacity is '+CAP+'.';return}items.push(v);val.value='';msg.textContent=(isStack()?'push(':'enqueue(')+v+')';draw()};
rem.onclick=function(){if(!items.length){msg.textContent=isStack()?'Stack underflow: the stack is empty.':'Queue is empty.';return}var v=isStack()?items.pop():items.shift();msg.textContent=(isStack()?'pop() returned ':'dequeue() returned ')+v;draw()};
document.getElementById('clr').onclick=function(){items=[];msg.textContent='';draw()};kind.onchange=function(){items=[];msg.textContent='';draw()};draw();`,
    },
  },
];
