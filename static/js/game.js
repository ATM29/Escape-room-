
(function(){
  const timerEls = document.querySelectorAll('#timer');
  function tick(){ const st = parseInt(localStorage.getItem('detective_started')||0); const elapsed = st ? Math.floor((Date.now()-st)/1000) : 0; timerEls.forEach(el=> el.textContent = formatTime(elapsed)); }
  function formatTime(s){ const mm = String(Math.floor(s/60)).padStart(2,'0'); const ss = String(s%60).padStart(2,'0'); return mm+':'+ss; }
  setInterval(tick,1000); tick();
  if(window.location.pathname.includes('/room/')){ if(!localStorage.getItem('detective_started')) localStorage.setItem('detective_started', Date.now()); }

  function addNote(text){ const notes = JSON.parse(localStorage.getItem('detective_notes')||'[]'); notes.push({text:text, when: new Date().toISOString()}); localStorage.setItem('detective_notes', JSON.stringify(notes)); }
  const nbBtn = document.getElementById('notebookBtn'); const notesModal = document.getElementById('notebook'); const closeNotes = document.getElementById('closeNotes');
  if(nbBtn) nbBtn.addEventListener('click', ()=>{ populateNotes(); notesModal.classList.remove('hidden'); });
  if(closeNotes) closeNotes.addEventListener('click', ()=> notesModal.classList.add('hidden'));
  function populateNotes(){ const notesEl = document.getElementById('notes'); const notes = JSON.parse(localStorage.getItem('detective_notes')||'[]'); notesEl.innerHTML = notes.length ? notes.map(n=> '<div><strong>'+ (new Date(n.when)).toLocaleTimeString() +'</strong>: '+ n.text + '</div>').join('') : '<div>No notes yet.</div>'; }

  document.querySelectorAll('#hintBtn').forEach(btn=> btn.addEventListener('click', async ()=>{
    const room = window.location.pathname.split('/').pop();
    try{ const resp = await fetch('/use_hint', {method:'POST'}); const data = await resp.json(); alert('Hint used. Hints used so far: '+data.hints_used + '\nTip: Inspect the room carefully. A notebook entry was added.'); addNote('Hint used for '+room); }
    catch(e){ alert('Could not use hint (server error).'); }
  }));

  document.getElementById('saveScore') && document.getElementById('saveScore').addEventListener('click', ()=>{
    const st = parseInt(localStorage.getItem('detective_started')||0); const elapsed = st ? Math.floor((Date.now()-st)/1000) : 0; const name = prompt('Detective name (short)'); if(!name) return; const lb = JSON.parse(localStorage.getItem('detective_leaderboard')||'[]'); lb.push({name:name, time:elapsed, when:new Date().toISOString()}); lb.sort((a,b)=> a.time - b.time); localStorage.setItem('detective_leaderboard', JSON.stringify(lb.slice(0,20))); alert('Saved to local leaderboard.'); });

  const leaderBtn = document.getElementById('leaderBtn'); const leaderModal = document.getElementById('leaderboard'); const closeLeader = document.getElementById('closeLeader');
  if(leaderBtn) leaderBtn.addEventListener('click', ()=>{ const lb = JSON.parse(localStorage.getItem('detective_leaderboard')||'[]'); const ol = document.getElementById('scores'); ol.innerHTML = lb.length ? lb.map(x=> '<li>'+x.name+' — '+Math.floor(x.time/60)+'m '+(x.time%60)+'s</li>').join('') : '<li>No scores yet</li>'; leaderModal.classList.remove('hidden'); });
  if(closeLeader) closeLeader.addEventListener('click', ()=> leaderModal.classList.add('hidden'));

  document.querySelectorAll('.cipher').forEach(c=> c.addEventListener('click', ()=>{ navigator.clipboard && navigator.clipboard.writeText(c.textContent).then(()=> alert('Cipher copied to clipboard')); }));

  function startAmbient(){
    if(window.__ambientStarted) return; try{ const ctx = new (window.AudioContext||window.webkitAudioContext)(); const master = ctx.createGain(); master.gain.value = 0.06; master.connect(ctx.destination);
      const osc = ctx.createOscillator(); osc.type='sine'; osc.frequency.value = 110; const osc2 = ctx.createOscillator(); osc2.type='sine'; osc2.frequency.value = 220; const g1 = ctx.createGain(); g1.gain.value = 0.5; osc.connect(g1); g1.connect(master); const g2 = ctx.createGain(); g2.gain.value = 0.12; osc2.connect(g2); g2.connect(master); osc.start(); osc2.start();
      const lfo = ctx.createOscillator(); lfo.type='sine'; lfo.frequency.value = 0.05; const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.04; lfo.connect(lfoGain); lfoGain.connect(master.gain); lfo.start();
      const bufferSize = ctx.sampleRate * 1.5; const noiseBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate); const data = noiseBuf.getChannelData(0); for(let i=0;i<data.length;i++) data[i] = (Math.random()*2-1)*0.007; const nb = ctx.createBufferSource(); nb.buffer = noiseBuf; nb.loop = true; const nbG = ctx.createGain(); nbG.gain.value = 0.6; nb.connect(nbG); nbG.connect(master); nb.start(); window.__ambientStarted = true;
    }catch(e){ console.log('Audio start failed', e); } }
  document.addEventListener('click', startAmbient, {once:true});
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('/static/sw.js').catch(()=>{}); }
})();