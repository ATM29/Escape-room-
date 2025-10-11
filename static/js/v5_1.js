
(function(){
  'use strict';
  const roomNames = {"room1": "Study", "room2": "Archive", "room3": "Interrogation", "room4": "Gallery", "room5": "Lab", "room6": "Locker", "room7": "Basement", "room8": "Alley", "room9": "Vault", "room10": "Final"};
  const prompts = {"room1": "Portrait is crooked; note reads: 'Left behind at every touch.' What is it?", "room2": "Cipher: MJ QQFYNJ MJ GZXXJ? (ROT-6, uppercase; searching allowed)", "room3": "Two witnesses say 9pm; one says 10pm. What's the inconsistency?", "room4": "A short note reads: NOTE. Enter that word to proceed.", "room5": "Locker: 7 - 2 - ? - 1 with 'mirror the middle pair'.", "room6": "Clerk's note: 'I had to ___.' (fill ADMIT).", "room7": "Torn letters 'K Y H O L E' around a key drawing. Reconstruct the word.", "room8": "Riddle: I follow when you walk, I shrink at noon, I stretch at dusk.", "room9": "Sort the items into boxes: Broken Glass (Physical), Email Log (Digital), Witness Note (Logic). Correct sorting reveals code.", "room10": "Final: Use initials from key solved rooms to form the final truth."};

  document.addEventListener('DOMContentLoaded', ()=>{
    const main = document.getElementById('mainContent');
    // Helper to fetch fragment HTML for a room and replace content
    async function loadRoom(room, push=true){
      try{
        const res = await fetch('/fragment/'+room);
        if(!res.ok) throw new Error('Failed to load');
        const html = await res.text();
        // render base fragment by injecting server-side template can't access roomNames here; server renders fragment with data
        main.innerHTML = html;
        if(push) history.pushState({room:room}, '', '/room/'+room);
        // re-run bindings for forms, nav links, hint button inside fragment
        bindFragmentControls();
      }catch(e){ console.error(e); location.href = '/room/'+room; }
    }

    // Bind global nav links with data-nav
    function bindNavLinks(){
      document.querySelectorAll('a[data-nav]').forEach(a=>{
        a.addEventListener('click', (ev)=>{
          ev.preventDefault();
          const href = a.getAttribute('href');
          if(href && href.startsWith('/room/')){
            const room = href.split('/').pop();
            loadRoom(room);
          } else if(href=== '/'){
            // reload index fragment
            fetch('/fragment/index').then(r=>r.text()).then(html=>{ main.innerHTML = html; history.pushState({}, '', '/'); bindFragmentControls(); });
          } else {
            location.href = href;
          }
        });
      });
    }

    // bind forms inside fragment to submit via AJAX
    async function bindFragmentControls(){
      bindNavLinks();
      // hint button inside fragment
      const hintBtn = document.getElementById('hintBtn');
      if(hintBtn) hintBtn.addEventListener('click', ()=>{
        const room = document.querySelector('input[name="room"]').value;
        const allow = document.querySelector('.hintline') !== null;
        if(!allow){ alert('Hints are not available for this room.'); return; }
        const lvl = parseInt(prompt('Hint level (1 gentle,2 direct). Costs 1 coin. Enter 1-2:')) || 0;
        if(lvl<1||lvl>2) return;
        fetch('/use_hint',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({room:room, level:lvl})})
          .then(r=> r.json()).then(d=>{ if(d.ok){ alert('Hint granted. Check your notebook. Coins left: '+d.coins); document.getElementById('coinCount').textContent = d.coins; addNote('Hint L'+lvl+' used for '+room); } else { alert('Hint unavailable: '+ (d.error||'')); }}).catch(()=> alert('Hint request failed.'));
      });
      // AJAX form submissions
      document.querySelectorAll('form[data-ajax-form]').forEach(f=>{
        f.addEventListener('submit', async (ev)=>{
          ev.preventDefault();
          const data = new FormData(f);
          const res = await fetch('/submit', {method:'POST', body: data});
          if(!res.ok){ alert('Submission failed'); return; }
          const html = await res.text();
          main.innerHTML = html;
          bindFragmentControls();
        });
      });
      // back to map link with data-nav already bound by bindNavLinks
    }

    // initial load: if path is /room/X, fetch that fragment; else load index fragment
    const path = window.location.pathname;
    if(path.startsWith('/room/')){
      const room = path.split('/').pop();
      // load full page server-rendered; fetch fragment to fill main content for SPA behavior
      fetch('/fragment/'+room).then(r=>r.text()).then(html=>{ document.getElementById('mainContent').innerHTML = html; bindFragmentControls(); });
    } else if(path === '/' || path === ''){
      fetch('/fragment/index').then(r=>r.text()).then(html=>{ main.innerHTML = html; bindFragmentControls(); });
    } else {
      // unknown path, go home
      fetch('/fragment/index').then(r=>r.text()).then(html=>{ main.innerHTML = html; bindFragmentControls(); });
    }

    // history popstate handler to handle browser back/forward
    window.addEventListener('popstate', (ev)=>{
      const p = location.pathname;
      if(p.startsWith('/room/')){
        const room = p.split('/').pop();
        fetch('/fragment/'+room).then(r=>r.text()).then(html=>{ main.innerHTML = html; bindFragmentControls(); });
      } else {
        fetch('/fragment/index').then(r=>r.text()).then(html=>{ main.innerHTML = html; bindFragmentControls(); });
      }
    });

    // Notebook helpers
    function addNote(text){ const notes = JSON.parse(localStorage.getItem('detective_notes')||'[]'); notes.push({text:text, when: new Date().toISOString()}); localStorage.setItem('detective_notes', JSON.stringify(notes)); }
    window.addNote = addNote; // export for other handlers

    // Audio persistent controller using <audio> elements in base
    let audTheme = document.getElementById('aud_theme');
    let audTension = document.getElementById('aud_tension');
    let audVictory = document.getElementById('aud_victory');
    let playingState = false;
    // Play theme or tension based on room index helper
    function setMusicForRoom(room){
      if(!audTheme) return;
      const idx = parseInt(room.replace('room',''));
      if(idx<=4){
        fadeVolumes(audTheme, 0.7); fadeVolumes(audTension, 0.0); fadeVolumes(audVictory, 0.0);
      } else if(idx<=8){
        fadeVolumes(audTheme, 0.2); fadeVolumes(audTension, 0.6); fadeVolumes(audVictory, 0.0);
      } else {
        fadeVolumes(audTheme, 0.0); fadeVolumes(audTension, 0.4); fadeVolumes(audVictory, 0.6);
      }
    }
    function ensurePlayables(){
      [audTheme,audTension,audVictory].forEach(a=>{ try{ if(a && a.paused) a.play().catch(()=>{}); a.volume = a.volume || 0; a.loop = true; }catch(e){} });
    }
    // smooth fade by steps
    function fadeVolumes(audioElem, target, steps=12, stepTime=40){
      if(!audioElem) return;
      ensurePlayables();
      const start = audioElem.volume || 0;
      const diff = target - start;
      for(let i=1;i<=steps;i++){
        setTimeout(()=>{
          audioElem.volume = Math.max(0, Math.min(1, start + diff*(i/steps)));
        }, i*stepTime);
      }
    }
    // play/pause button binding
    const playBtn = document.getElementById('playBtn');
    if(playBtn){
      playBtn.addEventListener('click', ()=>{
        if(!audTheme) { audTheme = document.getElementById('aud_theme'); audTension = document.getElementById('aud_tension'); audVictory = document.getElementById('aud_victory'); }
        if(!playingState){
          ensurePlayables();
          document.getElementById('playBtn').textContent = 'Pause';
          playingState = true;
          // set music to current room
          const curRoomInput = document.querySelector('input[name="room"]');
          const room = curRoomInput ? curRoomInput.value : 'room1';
          setMusicForRoom(room);
        } else {
          // pause all smoothly
          [audTheme,audTension,audVictory].forEach(a=>{ try{ a.volume = 0; }catch(e){} });
          document.getElementById('playBtn').textContent = 'Play';
          playingState = false;
        }
      });
    }
    // mute button toggles playback mute (pauses by lowering volume)
    const muteBtn = document.getElementById('muteBtn');
    if(muteBtn) muteBtn.addEventListener('click', ()=>{
      if(!audTheme) return;
      if(audTheme.muted){ [audTheme,audTension,audVictory].forEach(a=> a.muted=false); muteBtn.textContent='Mute'; }
      else { [audTheme,audTension,audVictory].forEach(a=> a.muted=true); muteBtn.textContent='Muted'; }
    });

    // when fragment loads, if it contains a room input, call setMusicForRoom
    function setMusicForCurrentFragment(){
      const curRoomInput = document.querySelector('input[name="room"]');
      if(curRoomInput) setMusicForRoom(curRoomInput.value);
    }
    // observe main content changes to adjust music
    const observer = new MutationObserver(()=> setMusicForCurrentFragment());
    observer.observe(main, {childList:true, subtree:true});

  }); // DOMContentLoaded
})();