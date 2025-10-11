
(function(){
  // Timer
  const timerEls = document.querySelectorAll('#timer');
  function tick(){ const st = parseInt(localStorage.getItem('detective_started')||0); const elapsed = st ? Math.floor((Date.now()-st)/1000) : 0; timerEls.forEach(el=> el.textContent = formatTime(elapsed)); }
  function formatTime(s){ const mm = String(Math.floor(s/60)).padStart(2,'0'); const ss = String(s%60).padStart(2,'0'); return mm+':'+ss; }
  setInterval(tick,1000); tick();
  if(window.location.pathname.includes('/room/')){ if(!localStorage.getItem('detective_started')) localStorage.setItem('detective_started', Date.now()); }

  // Notebook
  function addNote(text){ const notes = JSON.parse(localStorage.getItem('detective_notes')||'[]'); notes.push({text:text, when:new Date().toISOString()}); localStorage.setItem('detective_notes', JSON.stringify(notes)); populateNotes(); }
  function populateNotes(){ const notesEl = document.getElementById('notes'); if(!notesEl) return; const notes = JSON.parse(localStorage.getItem('detective_notes')||'[]'); notesEl.innerHTML = notes.length ? notes.map(n=> '<div><strong>'+ (new Date(n.when)).toLocaleTimeString() +'</strong>: '+ n.text + '</div>').join('') : '<div>No notes yet.</div>'; }
  const nbBtn = document.getElementById('notebookBtn'); const notesModal = document.getElementById('notebook'); const closeNotes = document.getElementById('closeNotes');
  if(nbBtn) nbBtn.addEventListener('click', ()=>{ populateNotes(); notesModal.classList.remove('hidden'); });
  if(closeNotes) closeNotes.addEventListener('click', ()=> notesModal.classList.add('hidden'));

  // Hints
  async function requestHint(level, room){
    try{
      const resp = await fetch('/use_hint', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({level:level, room:room})});
      if(!resp.ok){ alert('No coins or server error.'); return; }
      const data = await resp.json();
      const hints = {
        'room1':['Think of what you leave on surfaces you touch.','Unique to a person.','Fingerprint.'],
        'room2':['Shift letters back by 6.','Uppercase and take first word.','EVIDENCE'],
        'room3':['Two say 9pm, one says 10pm.','When accounts differ, it's an ALIBI.','ALIBI'],
        'room4':['Tap the three marked spots.','Find all three to unlock.','SPOTTED'],
        'room5':['Mirror the middle digits.','Mirror 2 and ? to get 29 -> 7291.','7291'],
        'room6':['A 7-letter word meaning admit: CONFESS.','CONFESS'],
        'room7':['Rearrange letters around key: KEYHOLE.','KEYHOLE'],
        'room8':['Appears with light: SHADOW.','SHADOW'],
        'room9':['Sort items correctly to reveal code 2468.','2468'],
        'room10':['Initials of clues form final word RECKON.','RECKON']
      };
      const roomKey = window.location.pathname.includes('/room/') ? window.location.pathname.split('/').pop() : 'room1';
      const text = (hints[roomKey] && hints[roomKey][Math.min(level-1, hints[roomKey].length-1)]) || 'No hint.';
      addNote('Hint L'+level+' '+roomKey+': '+text);
      alert('Hint L'+level+': '+text+'\nCoins left: '+data.coins);
      document.getElementById('coinCount') && (document.getElementById('coinCount').textContent = data.coins);
    }catch(e){ alert('Failed to request hint.'); }
  }
  document.querySelectorAll('#hintBtn').forEach(btn=> btn.addEventListener('click', ()=>{
    const room = window.location.pathname.split('/').pop();
    const lvl = parseInt(prompt('Hint level (1 easy,2 direct,3 reveal). Costs 1 coin. Enter 1-3:')) || 0;
    if(lvl<1 || lvl>3) return;
    requestHint(lvl, room);
  }));

  // Spot-the-diff setup
  (function(){
    const left = document.getElementById('photoLeft');
    if(!left) return;
    const right = document.getElementById('photoRight');
    const spots = Array.from(left.querySelectorAll('.spot'));
    let found = new Set();
    function mark(e){ const id = e.target.getAttribute('data-id'); if(found.has(id)) return; found.add(id); e.target.style.opacity='0.4'; const m = right.querySelector('.spot[data-id="'+id+'"]'); if(m) m.style.opacity='0.4'; if(found.size>=3){ const f = document.querySelector('#spotForm input[name="answer"]'); if(f) f.value='SPOTTED'; alert('All differences found!'); } }
    spots.forEach(s=> s.addEventListener('click', mark));
    Array.from(right.querySelectorAll('.spot')).forEach(s=> s.addEventListener('click', mark));
  })();

  // Sorter setup
  (function(){
    const items = document.querySelectorAll('.item');
    const boxes = document.querySelectorAll('.box');
    const form = document.getElementById('sortForm');
    if(!form) return;
    items.forEach(it=> it.addEventListener('dragstart', e=> e.dataTransfer.setData('text/plain', it.getAttribute('data-type'))));
    boxes.forEach(b=>{ b.addEventListener('dragover', e=> e.preventDefault()); b.addEventListener('drop', e=>{ e.preventDefault(); const type = e.dataTransfer.getData('text/plain'); const accept = b.getAttribute('data-accept'); if(type===accept){ b.appendChild(document.querySelector('.item[data-type="'+type+'"]')); b.style.border='2px solid #6ee7b7'; } else { b.style.border='2px solid #f3a'; } const correct = Array.from(boxes).every(bb=>{ const child = bb.querySelector('.item'); return child && child.getAttribute('data-type')===bb.getAttribute('data-accept'); }); if(correct){ const ans = document.querySelector('#sortForm input[name="answer"]'); if(ans) ans.value='2468'; alert('Sorted! Code filled.'); } }); });
    // mobile tap fallback
    items.forEach(it=> it.addEventListener('click', ()=>{ const type = it.getAttribute('data-type'); for(const b of boxes){ if(b.getAttribute('data-accept')===type){ b.appendChild(it); break; } } const correct = Array.from(boxes).every(bb=>{ const child = bb.querySelector('.item'); return child && child.getAttribute('data-type')===bb.getAttribute('data-accept'); }); if(correct){ const ans = document.querySelector('#sortForm input[name="answer"]'); if(ans) ans.value='2468'; alert('Sorted! Code filled.'); } }));
  })();

  // Ambient procedural music: layered pads and gentle melody
  let audioCtx=null, master=null, nodes=[];
  function initAudio(){ if(audioCtx) return; try{ audioCtx = new (window.AudioContext||window.webkitAudioContext)(); master = audioCtx.createGain(); master.gain.value = 0.06; master.connect(audioCtx.destination); // pad
    const pad = audioCtx.createOscillator(); pad.type='sine'; pad.frequency.value = 50; const padG = audioCtx.createGain(); padG.gain.value = 0.02; pad.connect(padG); padG.connect(master); pad.start(); nodes.push(pad); // melody
    const mel = audioCtx.createOscillator(); mel.type='triangle'; mel.frequency.value = 220; const melG = audioCtx.createGain(); melG.gain.value = 0.02; mel.connect(melG); melG.connect(master); mel.start(); nodes.push(mel); // noise
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate*1.2, audioCtx.sampleRate); const data = buf.getChannelData(0); for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1)*0.003; const src = audioCtx.createBufferSource(); src.buffer=buf; src.loop=true; const srcG=audioCtx.createGain(); srcG.gain.value=0.6; src.connect(srcG); srcG.connect(master); src.start(); nodes.push(src); }catch(e){ console.log('audio failed',e);} }
  document.addEventListener('click', ()=>{ initAudio(); }, {once:true});
  const audioToggle = document.getElementById('audioToggle'); if(audioToggle) audioToggle.addEventListener('click', ()=>{ if(!audioCtx) initAudio(); if(master) master.gain.value = master.gain.value>0 ? 0 : 0.06; });

  // leaderboard save
  document.getElementById('saveScore') && document.getElementById('saveScore').addEventListener('click', ()=>{ const st = parseInt(localStorage.getItem('detective_started')||0); const elapsed = st ? Math.floor((Date.now()-st)/1000) : 0; const name = prompt('Enter name'); if(!name) return; const lb = JSON.parse(localStorage.getItem('detective_leaderboard')||'[]'); lb.push({name:name, time:elapsed, when:new Date().toISOString()}); lb.sort((a,b)=>a.time-b.time); localStorage.setItem('detective_leaderboard', JSON.stringify(lb.slice(0,20))); alert('Saved'); });

  const showLeader = document.getElementById('showLeader'); const leaderModal = document.getElementById('leaderModal');
  if(showLeader) showLeader.addEventListener('click', ()=>{ const lb = JSON.parse(localStorage.getItem('detective_leaderboard')||'[]'); const ol = document.getElementById('scores'); if(ol) ol.innerHTML = lb.length ? lb.map(x=>'<li>'+x.name+' — '+Math.floor(x.time/60)+'m '+(x.time%60)+'s</li>').join('') : '<li>No scores yet</li>'; leaderModal.classList.remove('hidden'); });
  document.getElementById('closeLeader') && document.getElementById('closeLeader').addEventListener('click', ()=> leaderModal.classList.add('hidden'));

  // notes populate
  (function(){ const n = document.getElementById('notes'); if(n) { const notes = JSON.parse(localStorage.getItem('detective_notes')||'[]'); n.innerHTML = notes.length ? notes.map(x=> '<div><strong>'+ (new Date(x.when)).toLocaleTimeString() +'</strong>: '+ x.text + '</div>').join('') : '<div>No notes yet.</div>'; } })();
  // service worker
  if('serviceWorker' in navigator) navigator.serviceWorker.register('/static/sw.js').catch(()=>{});
})();
