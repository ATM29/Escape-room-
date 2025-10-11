
(function(){
  'use strict';
  document.addEventListener('DOMContentLoaded', ()=>{
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

    // Leaderboard modal
    const showLeader = document.getElementById('showLeader'); const leaderModal = document.getElementById('leaderModal'); const closeLeader = document.getElementById('closeLeader');
    if(showLeader) showLeader.addEventListener('click', ()=>{ const lb = JSON.parse(localStorage.getItem('detective_leaderboard')||'[]'); const ol = document.getElementById('scores'); if(ol) ol.innerHTML = lb.length ? lb.map(x=> '<li>'+x.name+' — '+Math.floor(x.time/60)+'m '+(x.time%60)+'s</li>').join('') : '<li>No scores yet</li>'; leaderModal.classList.remove('hidden'); });
    if(closeLeader) closeLeader.addEventListener('click', ()=> leaderModal.classList.add('hidden'));

    // Save score
    const saveScore = document.getElementById('saveScore');
    if(saveScore) saveScore.addEventListener('click', ()=>{ const st = parseInt(localStorage.getItem('detective_started')||0); const elapsed = st ? Math.floor((Date.now()-st)/1000) : 0; const name = prompt('Detective name (short)'); if(!name) return; const lb = JSON.parse(localStorage.getItem('detective_leaderboard')||'[]'); lb.push({name:name, time:elapsed, when:new Date().toISOString()}); lb.sort((a,b)=> a.time - b.time); localStorage.setItem('detective_leaderboard', JSON.stringify(lb.slice(0,20))); alert('Saved locally.'); });

    // Hint system - only allow client-side if room has hints marker
    document.querySelectorAll('#hintBtn').forEach(btn=> btn.addEventListener('click', ()=>{
      const room = window.location.pathname.split('/').pop();
      const allowed = document.querySelector('.hintline') !== null;
      if(!allowed){ alert('Hints are not available for this room.'); return; }
      const lvl = parseInt(prompt('Hint level (1 gentle,2 direct). Costs 1 coin. Enter 1-2:')) || 0;
      if(lvl<1 || lvl>2) return;
      requestHint(lvl, room);
    }));
    async function requestHint(level, room){
      try{
        const resp = await fetch('/use_hint', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({level:level, room:room})});
        if(!resp.ok){ const err = await resp.json().catch(()=>({error:'server'})); alert('Hint not available or no coins.'); return; }
        const data = await resp.json();
        // directional hints per room — not revealing full answer
        const hintMap = {
          'room2': ['Shift letters back by 6 and uppercase; first word is important.','Think "what you keep as proof".'],
          'room9': ['Sort carefully: Broken Glass -> Physical; Email Log -> Digital; Witness Note -> Logic.','Correct sorting reveals a 4-digit code.'],
          'room10':['Use initials from key solved rooms. Arrange them to form a meaningful word.','Try using the first letters of EVIDENCE, NOTE, ADMIT, SHADOW, (code).']
        };
        const texts = hintMap[room] || ['No further hint.'];
        const text = texts[Math.min(level-1, texts.length-1)];
        addNote('Hint L'+level+' for '+room+': '+text);
        alert('Hint L'+level+': '+text + '\nCoins left: '+data.coins);
        document.getElementById('coinCount') && (document.getElementById('coinCount').textContent = data.coins);
      }catch(e){ alert('Failed to request hint.'); }
    }

    // Sorting logic for room9 (tap and drag supported)
    (function sorter(){ const form = document.getElementById('sortForm'); if(!form) return; const items = document.querySelectorAll('.item'); const boxes = document.querySelectorAll('.box'); items.forEach(it=> it.addEventListener('dragstart', e=> e.dataTransfer.setData('text/plain', it.getAttribute('data-type')))); boxes.forEach(b=>{ b.addEventListener('dragover', e=> e.preventDefault()); b.addEventListener('drop', e=>{ e.preventDefault(); const type = e.dataTransfer.getData('text/plain'); const moved = document.querySelector('.item[data-type="'+type+'"]'); if(moved) b.appendChild(moved); check(); }); }); items.forEach(it=> it.addEventListener('click', ()=>{ const type = it.getAttribute('data-type'); for(const b of boxes){ if(b.getAttribute('data-accept')===type){ b.appendChild(it); break; } } check(); })); function check(){ const correct = Array.from(boxes).every(bb=>{ const child = bb.querySelector('.item'); return child && child.getAttribute('data-type')===bb.getAttribute('data-accept'); }); if(correct){ const ans = document.querySelector('#sortForm input[name="answer"]'); if(ans){ ans.value='2468'; alert('Correctly sorted — code filled.'); } } } })();

    // Audio loading & playback (WAV files created server-side). Crossfade between theme and tension.
    let audioCtx=null, themeBuf=null, tensionBuf=null, victoryBuf=null, themeSrc=null, tensionSrc=null, gainTheme=null, gainTension=null, playing=false;
    async function initAudio(){
      if(audioCtx) return;
      try{
        audioCtx = new (window.AudioContext||window.webkitAudioContext)();
        const master = audioCtx.createGain(); master.gain.value = 0.8; master.connect(audioCtx.destination);
        // load buffers
        async function loadFile(path){ const r = await fetch(path); const ab = await r.arrayBuffer(); return await audioCtx.decodeAudioData(ab); }
        themeBuf = await loadFile('/static/audio/detective_theme.wav');
        tensionBuf = await loadFile('/static/audio/tension_loop.wav');
        victoryBuf = await loadFile('/static/audio/victory.wav');
        // create sources & gains
        function createPlayer(buf){ const src = audioCtx.createBufferSource(); src.buffer = buf; src.loop = true; const g = audioCtx.createGain(); g.gain.value = 0.0; src.connect(g); g.connect(master); src.start(); return {src, g}; }
        const t = createPlayer(themeBuf); themeSrc = t.src; gainTheme = t.g;
        const tn = createPlayer(tensionBuf); tensionSrc = tn.src; gainTension = tn.g;
      }catch(e){ console.log('audio init failed', e); }
    }
    async function playTheme(){ if(!audioCtx) await initAudio(); if(gainTheme) gainTheme.gain.setTargetAtTime(0.4, audioCtx.currentTime, 0.5); playing = true; document.getElementById('playBtn').textContent = 'Pause'; }
    function stopAll(){ if(!audioCtx) return; if(gainTheme) gainTheme.gain.setTargetAtTime(0, audioCtx.currentTime, 0.5); if(gainTension) gainTension.gain.setTargetAtTime(0, audioCtx.currentTime, 0.5); playing = false; document.getElementById('playBtn').textContent = 'Play'; }
    async function playTension(){ if(!audioCtx) await initAudio(); if(gainTension) gainTension.gain.setTargetAtTime(0.35, audioCtx.currentTime, 0.5); if(gainTheme) gainTheme.gain.setTargetAtTime(0.12, audioCtx.currentTime, 0.5); playing = true; document.getElementById('playBtn').textContent = 'Pause'; }
    // Play/pause button
    const playBtn = document.getElementById('playBtn'); if(playBtn) playBtn.addEventListener('click', async ()=>{ if(!audioCtx){ await initAudio(); await playTheme(); } else { if(playing) stopAll(); else await playTheme(); } });
    const muteBtn = document.getElementById('muteBtn'); if(muteBtn) muteBtn.addEventListener('click', ()=>{ if(!audioCtx) return; const master = audioCtx.destination; // can't change destination gain easily; workaround: toggle play/pause
      if(playing) { stopAll(); muteBtn.textContent='Muted'; } else { playTheme(); muteBtn.textContent='Mute'; } });

    // auto-init audio on first user gesture so mobile allows playback later
    document.addEventListener('click', ()=>{ initAudio(); }, {once:true});

    // populate notes
    (function(){ const n = document.getElementById('notes'); if(n){ const notes = JSON.parse(localStorage.getItem('detective_notes')||'[]'); n.innerHTML = notes.length ? notes.map(x=> '<div><strong>'+ (new Date(x.when)).toLocaleTimeString() +'</strong>: '+ x.text + '</div>').join('') : '<div>No notes yet.</div>'; } })();

  }); // DOMContentLoaded
})();