
(function(){
  // Timer with resume support (localStorage + server session works together)
  const timerEls = document.querySelectorAll('#timer');
  function tick(){ const st = parseInt(localStorage.getItem('detective_started')||0); const elapsed = st ? Math.floor((Date.now()-st)/1000) : 0; timerEls.forEach(el=> el.textContent = formatTime(elapsed)); }
  function formatTime(s){ const mm = String(Math.floor(s/60)).padStart(2,'0'); const ss = String(s%60).padStart(2,'0'); return mm+':'+ss; }
  setInterval(tick,1000); tick();
  if(window.location.pathname.includes('/room/')){ if(!localStorage.getItem('detective_started')) localStorage.setItem('detective_started', Date.now()); }
  // Notebook (local)
  function addNote(text){ const notes = JSON.parse(localStorage.getItem('detective_notes')||'[]'); notes.push({text:text, when: new Date().toISOString()}); localStorage.setItem('detective_notes', JSON.stringify(notes)); populateNotes(); }
  function populateNotes(){ const notesEl = document.getElementById('notes'); if(!notesEl) return; const notes = JSON.parse(localStorage.getItem('detective_notes')||'[]'); notesEl.innerHTML = notes.length ? notes.map(n=> '<div><strong>'+ (new Date(n.when)).toLocaleTimeString() +'</strong>: '+ n.text + '</div>').join('') : '<div>No notes yet.</div>'; }
  // Show notebook
  const nbBtn = document.getElementById('notebookBtn'); const notesModal = document.getElementById('notebook'); const closeNotes = document.getElementById('closeNotes'); if(nbBtn) nbBtn.addEventListener('click', ()=>{ populateNotes(); notesModal.classList.remove('hidden'); }); if(closeNotes) closeNotes.addEventListener('click', ()=> notesModal.classList.add('hidden'));
  // Hint system: client has per-room hint text tiers. Spend a coin to unlock a tier.
  const hintTexts = {
    'room1': ['Think of what you leave on a surface you touch.','It is unique to a person.','It helps ID someone: fingerprint.'],
    'room2': ['Rotate letters back by 6.','Make result uppercase and take first word.','EVIDENCE'],
    'room3': ['Check contradictions: time vs witness.','Motive suggested by hiding: ALIBI.','ALIBI'],
    'room4': ['Second swatch from left is B:GREEN?','Wait: labeled A RED, B GREEN, C BLUE -> second is GREEN.','GREEN or BLUE depending on label.'],
    'room5': ['7-2-? -1 and "mirror middle pair".','Mirror middle of 2 and ? yields 29 -> code 7291.','7291'],
    'room6': ['7-letter word: admitting is "confess".','Think of "I had to ____" -> confess.','CONFESS'],
    'room7': ['Rearrange letters K Y H O L E -> KEYHOLE.','It fits the key drawing.','KEYHOLE'],
    'room8': ['Follows you but never leads -> shadow.','Shadow appears with light.','SHADOW'],
    'room9': ['Even ascending sequence -> 2,4,6,8.','Type 2468.','2468'],
    'room10': ['Map numbers to phone keypad (2=ABC etc).','Combine digits from earlier timestamps.','TRUTH'],
    'room11': ['Mirror clue: reverse a short word to read correctly.','Think of reflective surface: mirror.','MIRROR'],
    'room12': ['Take first letters from rooms 2,4,6,8,10,11.','They spell R T C S T M -> rearrange to RECKON?','RECKON']
  };
  async function requestHint(level, room){
    try{
      const resp = await fetch('/use_hint', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({level: level, room: room})});
      if(!resp.ok){ const err = await resp.json().catch(()=>({error:'server'})); alert('No coins or server error.'); return; }
      const data = await resp.json();
      // show hint tier from hintTexts
      const text = (hintTexts[room] && hintTexts[room][Math.min(level-1, hintTexts[room].length-1)]) || 'No hint.';
      addNote('Hint L'+level+' for '+room+': '+text);
      alert('Hint (L'+level+'): '+text + '\nCoins left: '+data.coins);
      document.getElementById('coinCount') && (document.getElementById('coinCount').textContent = data.coins);
    }catch(e){ alert('Failed to request hint.'); }
  }
  document.querySelectorAll('#hintBtn').forEach(btn=> btn.addEventListener('click', ()=>{
    const room = window.location.pathname.split('/').pop();
    const lvl = parseInt(prompt('Hint level (1 gentle, 2 direct, 3 reveal structure). Costs 1 coin. Enter 1-3:')) || 0;
    if(lvl<1 || lvl>3) return;
    requestHint(lvl, room);
  }));
  // Save score
  document.getElementById('saveScore') && document.getElementById('saveScore').addEventListener('click', ()=>{
    const st = parseInt(localStorage.getItem('detective_started')||0); const elapsed = st ? Math.floor((Date.now()-st)/1000) : 0; const name = prompt('Detective name (short)'); if(!name) return; const lb = JSON.parse(localStorage.getItem('detective_leaderboard')||'[]'); lb.push({name:name, time:elapsed, when:new Date().toISOString()}); lb.sort((a,b)=> a.time - b.time); localStorage.setItem('detective_leaderboard', JSON.stringify(lb.slice(0,20))); alert('Saved to local leaderboard.');
  });
  // Leaderboard modal controls
  const leaderBtn = document.getElementById('leaderBtn'); const leaderModal = document.getElementById('leaderboard'); const closeLeader = document.getElementById('closeLeader'); if(leaderBtn) leaderBtn.addEventListener('click', ()=>{ const lb = JSON.parse(localStorage.getItem('detective_leaderboard')||'[]'); const ol = document.getElementById('scores'); if(ol) ol.innerHTML = lb.length ? lb.map(x=> '<li>'+x.name+' — '+Math.floor(x.time/60)+'m '+(x.time%60)+'s</li>').join('') : '<li>No scores yet</li>'; leaderModal && leaderModal.classList.remove('hidden'); }); if(closeLeader) closeLeader.addEventListener('click', ()=> leaderModal && leaderModal.classList.add('hidden'));
  // Cipher tap-to-copy
  document.querySelectorAll('.cipher').forEach(c=> c.addEventListener('click', ()=>{ navigator.clipboard && navigator.clipboard.writeText(c.textContent).then(()=> alert('Cipher copied to clipboard')); }));
  // Audio: play provided mp3s if present; fallback to gentle oscillator
  let audio = {ctx:null, music:null, playing:false};
  function initAudio(){ if(audio.ctx) return; try{ audio.ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ audio.ctx = null; } }
  async function playMusic(){
    initAudio();
    if(!audio.ctx){ return; }
    if(audio.playing) return;
    // try to load static/audio/detective_theme.mp3 from server; if missing, fallback to oscillator texture
    try{
      const resp = await fetch('/static/audio/detective_theme.mp3');
      if(resp.ok){
        const ab = await resp.arrayBuffer();
        const buf = await audio.ctx.decodeAudioData(ab);
        const src = audio.ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        const g = audio.ctx.createGain(); g.gain.value = 0.45; src.connect(g); g.connect(audio.ctx.destination);
        src.start();
        audio.music = src; audio.playing = true;
        return;
      }
    }catch(e){ /* fallthrough */ }
    // fallback oscillator ambient
    try{
      const osc = audio.ctx.createOscillator(); osc.type='sine'; osc.frequency.value = 110; const g = audio.ctx.createGain(); g.gain.value = 0.02; osc.connect(g); g.connect(audio.ctx.destination); osc.start(); audio.music = osc; audio.playing = true;
    }catch(e){}
  }
  function stopMusic(){ try{ if(audio.music && audio.music.stop) audio.music.stop(); audio.music = null; audio.playing = false;}catch(e){} }
  // toggle button
  const audioToggle = document.getElementById('audioToggle'); if(audioToggle) audioToggle.addEventListener('click', ()=>{ if(!audio.playing) playMusic(); else stopMusic(); });
  // auto-start music on first user gesture if files exist or fallback
  document.addEventListener('click', ()=>{ playMusic(); }, {once:true});
  // service worker register
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('/static/sw.js').catch(()=>{}); }
  // update coin display from server occasionally
  async function refreshStatus(){ try{ const r = await fetch('/api/status'); if(r.ok){ const data = await r.json(); document.getElementById('coinCount') && (document.getElementById('coinCount').textContent = data.hint_coins); } }catch(e){} }
  setInterval(refreshStatus, 5000);
  refreshStatus();
  // populate notes on page load
  populateNotes();
})();