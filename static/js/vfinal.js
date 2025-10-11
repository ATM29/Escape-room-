
(function(){
  'use strict';
  const main = () => document.getElementById('mainContent');
  function qs(s){ return document.querySelector(s); }
  function qsa(s){ return Array.from(document.querySelectorAll(s)); }

  // Timer persisted in localStorage
  function startTimer(){
    if(!localStorage.getItem('detective_started')) localStorage.setItem('detective_started', Date.now());
    const el = qs('#timer');
    setInterval(()=>{
      const st = parseInt(localStorage.getItem('detective_started')||0);
      const sec = st ? Math.floor((Date.now()-st)/1000) : 0;
      el.textContent = formatTime(sec);
    },1000);
  }
  function formatTime(s){ const mm = String(Math.floor(s/60)).padStart(2,'0'); const ss = String(s%60).padStart(2,'0'); return mm+':'+ss; }

  // Notebook & notes
  function populateNotes(){ const el = qs('#notes'); if(!el) return; const notes = JSON.parse(localStorage.getItem('detective_notes')||'[]'); el.innerHTML = notes.length ? notes.map(n=> '<div><strong>'+ new Date(n.when).toLocaleTimeString() +'</strong>: '+ n.text +'</div>').join('') : '<div>No notes yet.</div>'; }
  function addNote(text){ const notes = JSON.parse(localStorage.getItem('detective_notes')||'[]'); notes.push({text:text, when:new Date().toISOString()}); localStorage.setItem('detective_notes', JSON.stringify(notes)); populateNotes(); }

  // Leaderboard local
  function saveToLeaderboard(){
    const st = parseInt(localStorage.getItem('detective_started')||0); const elapsed = st ? Math.floor((Date.now()-st)/1000) : 0;
    const name = prompt('Enter your name (short)') || 'Anon';
    const lb = JSON.parse(localStorage.getItem('detective_leaderboard')||'[]'); lb.push({name:name, time:elapsed, when:new Date().toISOString()}); lb.sort((a,b)=>a.time-b.time); localStorage.setItem('detective_leaderboard', JSON.stringify(lb.slice(0,20))); alert('Saved locally.'); 
  }

  // AJAX fragment loader
  async function loadFragment(path, push=true){
    try{
      const r = await fetch(path);
      if(!r.ok) throw new Error('Load failed');
      const html = await r.text();
      main().innerHTML = html;
      if(push){
        const url = path === '/fragment/index' ? '/' : '/room/' + path.split('/').pop();
        history.pushState({}, '', url);
      }
      bindFragment();
    }catch(e){
      console.error(e); window.location.href = path === '/fragment/index' ? '/' : '/room/' + path.split('/').pop();
    }
  }

  // Bind global UI
  function bindGlobal(){
    // notebook open/close
    const nbOpen = qs('#notebookBtn'), nbClose = qs('#closeNotes');
    if(nbOpen) nbOpen.addEventListener('click', ()=>{ populateNotes(); qs('#notebook').classList.remove('hidden'); });
    if(nbClose) nbClose.addEventListener('click', ()=> qs('#notebook').classList.add('hidden'));

    // leaderboard modal
    const showLeader = qs('#showLeader'), closeLeader = qs('#closeLeader');
    if(showLeader) showLeader.addEventListener('click', ()=>{ const lb = JSON.parse(localStorage.getItem('detective_leaderboard')||'[]'); const ol = qs('#scores'); if(ol) ol.innerHTML = lb.length ? lb.map(x=> '<li>'+x.name+' — '+Math.floor(x.time/60)+'m '+(x.time%60)+'s</li>').join('') : '<li>No scores</li>'; qs('#leaderModal').classList.remove('hidden'); });
    if(closeLeader) closeLeader.addEventListener('click', ()=> qs('#leaderModal').classList.add('hidden'));

    // play/mute audio controls
    const playBtn = qs('#playBtn'), muteBtn = qs('#muteBtn');
    const audTheme = qs('#aud_theme'), audTension = qs('#aud_tension'), audVictory = qs('#aud_victory');
    let playing = false;
    function ensurePlay(a){ try{ a.play().catch(()=>{}); }catch(e){} }
    function fade(a, target){ if(!a) return; try{ if(a.paused) a.play().catch(()=>{}); }catch(e){} const start = a.volume || 0; const steps = 12; for(let i=1;i<=steps;i++){ setTimeout(()=> a.volume = Math.max(0, Math.min(1, start + (target-start)*(i/steps))), i*40); } }
    function setMusicForRoom(room){
      const idx = parseInt((room||'room1').replace('room','')) || 1;
      if(idx<=4){ fade(audTheme,0.7); fade(audTension,0); fade(audVictory,0); }
      else if(idx<=8){ fade(audTheme,0.15); fade(audTension,0.6); fade(audVictory,0); }
      else { fade(audTheme,0); fade(audTension,0.4); fade(audVictory,0.6); }
    }
    if(playBtn) playBtn.addEventListener('click', ()=>{
      if(!playing){ [audTheme,audTension,audVictory].forEach(a=> ensurePlay(a)); playBtn.textContent='Pause'; playing=true; const roomInput = document.querySelector('input[name="room"]'); setMusicForRoom(roomInput?roomInput.value:'room1'); } else { [audTheme,audTension,audVictory].forEach(a=> fade(a,0)); playBtn.textContent='Play'; playing=false; }
    });
    if(muteBtn) muteBtn.addEventListener('click', ()=>{ if(!audTheme) return; const newMuted = !audTheme.muted; [audTheme,audTension,audVictory].forEach(a=> a.muted = newMuted); muteBtn.textContent = newMuted ? 'Muted' : 'Mute'; });
  }

  // bind interactions inside fragment
  function bindFragment(){
    // nav links
    main().querySelectorAll('a[data-nav]').forEach(a=>{ a.onclick = (ev)=>{ ev.preventDefault(); const href = a.getAttribute('href'); if(href && href.startsWith('/room/')) loadFragment('/fragment/'+href.split('/').pop()); else if(href === '/') loadFragment('/fragment/index'); else window.location.href = href; }; });
    // AJAX forms
    main().querySelectorAll('form[data-ajax-form]').forEach(f=>{ f.onsubmit = async (ev)=>{ ev.preventDefault(); const fd = new FormData(f); try{ const resp = await fetch(f.action, {method:'POST', body:fd}); if(!resp.ok){ alert('Submit failed'); return; } const html = await resp.text(); main().innerHTML = html; bindFragment(); }catch(e){ alert('Submission error'); } }; });
    // hint button
    const hintBtn = main().querySelector('#hintBtn');
    if(hintBtn) hintBtn.addEventListener('click', async ()=>{ const roomInput = main().querySelector('input[name="room"]'); if(!roomInput){ alert('No room context'); return; } const room = roomInput.value; const lvl = parseInt(prompt('Hint level (1 gentle,2 direct). Costs 1 coin. Enter 1-2:'))||0; if(lvl<1||lvl>2) return; try{ const r = await fetch('/use_hint', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({room:room, level:lvl})}); const dj = await r.json(); if(!r.ok){ alert('Hint unavailable: '+(dj.error||'')); return; } const hints = {'room2':['Shift letters back by 6; look at the first word.','Think what proves a case.'],'room9':['Broken Glass->Physical; Email->Digital; Note->Logic.','Sorting reveals a 4-digit code.'],'room10':['Use initials from key clues to form a word.','Try arranging them sensibly.'],'room12':['Think who benefits; name the scheme.','Consider who had motive and access.']}; const texts = hints[room]||['No hint.']; const text = texts[Math.min(lvl-1, texts.length-1)]; addNote('Hint L'+lvl+' for '+room+': '+text); alert('Hint: '+text+'\nCoins left: '+dj.coins); document.getElementById('coinCount').textContent = dj.coins; }catch(e){ alert('Hint request failed'); } });
    // saveScore button inside fragment
    const saveBtn = main().querySelector('#saveScore'); if(saveBtn) saveBtn.addEventListener('click', saveToLeaderboard);
    // auto focus input
    const inpt = main().querySelector('input[name="answer"]'); if(inpt){ inpt.focus(); setTimeout(()=> inpt.blur(), 800); }
    // when fragment loads, inform audio controller to set appropriate music (if playing)
    const roomInput = main().querySelector('input[name="room"]'); if(roomInput){
      // dispatch event for music set
      window.dispatchEvent(new CustomEvent('room-change', {detail: {room: roomInput.value}}));
    }
  }

  // initial boot
  document.addEventListener('DOMContentLoaded', ()=>{
    startTimer(); bindGlobal();
    const path = location.pathname;
    if(path === '/' || path === '') loadFragment('/fragment/index', false);
    else if(path.startsWith('/room/')) loadFragment('/fragment/'+path.split('/').pop(), false);
    else loadFragment('/fragment/index', false);
    populateNotes();
  });

  // adjust music when room-change happens (bridge to play state)
  window.addEventListener('room-change', (e)=>{
    const playBtn = qs('#playBtn');
    if(playBtn && playBtn.textContent === 'Pause'){
      // simulate setting music by triggering click to re-evaluate (cheap hack)
      // safer: call setMusicForRoom directly but keep state simple here
      playBtn.click(); playBtn.click();
    }
  });

})();