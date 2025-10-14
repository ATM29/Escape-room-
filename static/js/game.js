
(function(){
  function pad(n){ return String(n).padStart(2,'0'); }
  function fmt(s){ return pad(Math.floor(s/60))+':'+pad(s%60); }
  const timerEl = document.getElementById('timer');
  function startTimer(){
    const st = parseInt(localStorage.getItem('detective_started')||0);
    if(!st) return;
    setInterval(()=>{ if(timerEl) timerEl.textContent = fmt(Math.floor((Date.now()-st)/1000)); }, 500);
  }
  startTimer();

  const bg = document.getElementById('bg');
  const mute = document.getElementById('mute');
  if(bg){ bg.play().catch(()=>{}); }
  if(mute){
    mute.addEventListener('click', ()=>{ if(!bg) return; bg.muted = !bg.muted; mute.textContent = bg.muted ? 'Unmute' : 'Mute'; });
  }

  const playClue = document.getElementById('playClue');
  if(playClue){
    const clue = document.getElementById('cluePlayer');
    playClue.addEventListener('click', ()=>{ if(bg) bg.play().catch(()=>{}); clue.currentTime = 0; clue.play().catch(()=>{}); });
  }

  const form = document.getElementById('answerForm');
  if(form){
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const data = new FormData(form);
      const resp = await fetch(form.action, {method:'POST', body: data});
      if(resp.ok){
        const html = await resp.text();
        document.getElementById('message').innerHTML = html;
      } else alert('Submit failed');
    });
  }

  const lbBtn = document.getElementById('showLeaderboard');
  const modal = document.getElementById('leaderModal');
  if(lbBtn && modal){
    lbBtn.addEventListener('click', async ()=>{
      const resp = await fetch('/leaderboard.json');
      const data = await resp.json();
      const ol = document.getElementById('scores');
      ol.innerHTML = data.length ? data.map(x=> `<li>${x.name} — ${Math.floor(x.time/60)}m ${x.time%60}s</li>`).join('') : '<li>No scores</li>';
      modal.classList.remove('hidden');
    });
    document.getElementById('closeLeader').addEventListener('click', ()=> modal.classList.add('hidden'));
  }
})();
