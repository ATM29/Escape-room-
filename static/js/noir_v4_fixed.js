
(function(){
  'use strict';
  // safe DOMContentLoaded init
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

    // Hint button binding
    document.querySelectorAll('#hintBtn').forEach(btn=> btn.addEventListener('click', ()=>{
      const room = window.location.pathname.split('/').pop() || 'room1';
      const lvlStr = prompt('Hint level (1 easy,2 direct,3 reveal). Costs 1 coin. Enter 1-3:');
      const lvl = lvlStr ? parseInt(lvlStr) : 0;
      if(!lvl || lvl<1 || lvl>3) return;
      requestHint(lvl, room);
    }));

    async function requestHint(level, room){
      try{
        const resp = await fetch('/use_hint', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({level:level, room:room})});
        if(!resp.ok){ alert('No coins or server error. Earn coins by solving chapters.'); return; }
        const data = await resp.json();
        const hintText = getHintText(room, level);
        addNote('Hint L'+level+' for '+room+': '+hintText);
        alert('Hint L'+level+': '+hintText + '\nCoins left: '+data.coins);
        const cc = document.getElementById('coinCount'); if(cc) cc.textContent = data.coins;
      }catch(e){ alert('Failed to request hint.'); }
    }
    function getHintText(room, level){
      const hints = {
        'room1':['Think of what you leave on surfaces you touch.','Unique to a person.','Fingerprint.'],
        'room2':['Shift letters back by 6.','Uppercase and take first word.','EVIDENCE'],
        'room3':['Two say 9pm, one says 10pm.','When accounts differ, it\'s an ALIBI.','ALIBI'],
        'room4':['Tap the three gold marks on either photo.','Find all three to unlock.','SPOTTED'],
        'room5':['Mirror the middle digits.','Mirror 2 and ? to get 29 -> 7291.','7291'],
        'room6':['A 7-letter word meaning admit: CONFESS.','CONFESS'],
        'room7':['Rearrange letters around key: KEYHOLE.','KEYHOLE'],
        'room8':['Appears with light: SHADOW.','SHADOW'],
        'room9':['Sort items correctly to reveal code 2468.','2468'],
        'room10':['Initials of clues form final word RECKON.','RECKON']
      };
      return (hints[room] && hints[room][Math.min(level-1, hints[room].length-1)]) || 'No hint available.';
    }

    // Spot-the-diff logic (works on generated SVG spots)
    (function setupSpotGame(){
      const left = document.getElementById('photoLeft');
      const right = document.getElementById('photoRight');
      const formInput = document.querySelector('#spotForm input[name="answer"]');
      if(!left || !right || !formInput) return;
      // identify SVG elements by id s1,s2,s3 and s1r,s2r,s3r
      const ids = ['s1','s2','s3'];
      const found = new Set();
      ids.forEach(id => {
        const elLeft = left.querySelector('#'+id);
        const elRight = right.querySelector('#'+id+'r');
        if(elLeft){ elLeft.style.cursor='pointer'; elLeft.addEventListener('click', ()=> { if(found.has(id)) return; found.add(id); elLeft.setAttribute('opacity','0.4'); if(elRight) elRight.setAttribute('opacity','0.4'); if(found.size>=3){ formInput.value='SPOTTED'; alert('Found all differences!'); } }); }
        if(elRight){ elRight.style.cursor='pointer'; elRight.addEventListener('click', ()=> { if(found.has(id)) return; found.add(id); elRight.setAttribute('opacity','0.4'); if(left.querySelector('#'+id)) left.querySelector('#'+id).setAttribute('opacity','0.4'); if(found.size>=3){ formInput.value='SPOTTED'; alert('Found all differences!'); } }); }
      });
    })();

    // Sorter logic
    (function setupSorter(){
      const items = document.querySelectorAll('.item');
      const boxes = document.querySelectorAll('.box');
      const form = document.getElementById('sortForm');
      if(!form) return;
      items.forEach(it=>{
        it.addEventListener('dragstart', e=> e.dataTransfer.setData('text/plain', it.getAttribute('data-type')));
        it.addEventListener('touchstart', ()=>{}); // placeholder for mobile
      });
      boxes.forEach(b=>{
        b.addEventListener('dragover', e=> e.preventDefault());
        b.addEventListener('drop', e=>{
          e.preventDefault();
          const type = e.dataTransfer.getData('text/plain');
          const accept = b.getAttribute('data-accept');
          const moved = document.querySelector('.item[data-type="'+type+'"]');
          if(!moved) return;
          b.appendChild(moved);
          // visual feedback
          if(type===accept) b.style.border='2px solid #6ee7b7'; else b.style.border='2px solid #f36';
          checkSorted();
        });
      });
      // mobile tap to move
      items.forEach(it=> it.addEventListener('click', ()=>{
        const type = it.getAttribute('data-type');
        for(const b of boxes){
          if(b.getAttribute('data-accept')===type){
            b.appendChild(it);
            break;
          }
        }
        checkSorted();
      }));
      function checkSorted(){
        const correct = Array.from(boxes).every(bb=>{ const child = bb.querySelector('.item'); return child && child.getAttribute('data-type')===bb.getAttribute('data-accept'); });
        if(correct){
          const ans = document.querySelector('#sortForm input[name="answer"]');
          if(ans){ ans.value='2468'; alert('Items sorted correctly! Code 2468 filled.'); }
        }
      }
    })();

    // Leaderboard modal handlers
    const showLeader = document.getElementById('showLeader');
    const leaderModal = document.getElementById('leaderModal');
    const closeLeader = document.getElementById('closeLeader');
    if(showLeader) showLeader.addEventListener('click', ()=>{
      const lb = JSON.parse(localStorage.getItem('detective_leaderboard')||'[]');
      const ol = document.getElementById('scores');
      if(ol) ol.innerHTML = lb.length ? lb.map(x=> '<li>'+x.name+' — '+Math.floor(x.time/60)+'m '+(x.time%60)+'s</li>').join('') : '<li>No scores yet</li>';
      leaderModal.classList.remove('hidden');
    });
    if(closeLeader) closeLeader.addEventListener('click', ()=> leaderModal.classList.add('hidden'));

    // Save score button
    const saveScoreBtn = document.getElementById('saveScore');
    if(saveScoreBtn) saveScoreBtn.addEventListener('click', ()=>{
      const st = parseInt(localStorage.getItem('detective_started')||0); const elapsed = st ? Math.floor((Date.now()-st)/1000) : 0; const name = prompt('Enter name'); if(!name) return;
      const lb = JSON.parse(localStorage.getItem('detective_leaderboard')||'[]'); lb.push({name:name, time:elapsed, when:new Date().toISOString()}); lb.sort((a,b)=> a.time - b.time); localStorage.setItem('detective_leaderboard', JSON.stringify(lb.slice(0,20))); alert('Saved locally.');
    });

    // Procedural ambient audio - louder and musical, with explicit Play/Pause
    let audioCtx=null, master=null, nodes=[], playing=false;
    function initAudio(){
      if(audioCtx) return;
      try{
        audioCtx = new (window.AudioContext||window.webkitAudioContext)();
        master = audioCtx.createGain(); master.gain.value = 0.08; master.connect(audioCtx.destination);

        // low drone
        const drone = audioCtx.createOscillator(); drone.type='sine'; drone.frequency.value = 55;
        const dg = audioCtx.createGain(); dg.gain.value = 0.02; drone.connect(dg); dg.connect(master); drone.start();
        nodes.push(drone);

        // subtle melody intervals (sequence)
        const notes = [220, 164.81, 196, 246.94]; // A, E, G, B
        const melGain = audioCtx.createGain(); melGain.gain.value = 0.02; melGain.connect(master);
        let idx = 0;
        const melOsc = audioCtx.createOscillator(); melOsc.type='triangle'; melOsc.frequency.value = notes[0];
        melOsc.connect(melGain); melOsc.start();
        nodes.push(melOsc);
        setInterval(()=>{ idx = (idx+1) % notes.length; melOsc.frequency.setTargetAtTime(notes[idx], audioCtx.currentTime, 0.2); }, 900);

        // gentle noise texture
        const buf = audioCtx.createBuffer(1, audioCtx.sampleRate*1.0, audioCtx.sampleRate); const data = buf.getChannelData(0);
        for(let i=0;i<data.length;i++) data[i] = (Math.random()*2-1)*0.0025;
        const noise = audioCtx.createBufferSource(); noise.buffer = buf; noise.loop = true;
        const ng = audioCtx.createGain(); ng.gain.value = 0.5; noise.connect(ng); ng.connect(master); noise.start(); nodes.push(noise);

      }catch(e){ console.log('audio init failed', e); }
    }
    function toggleAudio(){
      if(!audioCtx) initAudio();
      playing = !playing;
      if(master) master.gain.setTargetAtTime(playing ? 0.08 : 0, audioCtx.currentTime, 0.05);
      const btn = document.getElementById('audioToggle');
      if(btn) btn.textContent = playing ? '🔈' : '🔊';
    }
    const audioToggle = document.getElementById('audioToggle');
    if(audioToggle) audioToggle.addEventListener('click', ()=>{ toggleAudio(); });
    // auto-init on first gesture but don't aggressively start sound until user toggles
    document.addEventListener('click', ()=>{ initAudio(); }, {once:true});

    // populate notes immediately
    populateNotes();

  }); // DOMContentLoaded
})();