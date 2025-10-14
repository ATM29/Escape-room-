
async function fetchJSON(path){ const r = await fetch(path); if(!r.ok) return null; return await r.json(); }
async function pollRound(){
  try{
    const j = await fetchJSON('/api/current_round');
    if(!j || !j.ok){ document.getElementById('names').textContent='Waiting for session...'; return; }
    document.getElementById('names').innerHTML = j.names.map((n,i)=> (i+1)+'. '+n).join('<br/>');
    document.getElementById('time_left').textContent = j.time_left;
    const players = await fetchJSON('/players.json');
    const mynum = localStorage.getItem('my_player_number');
    if(mynum && players){
      const me = players.find(p=> String(p.number) === String(mynum));
      if(me){ document.getElementById('playerNumber').textContent = me.number; document.getElementById('playerScore').textContent = me.score; }
    }
  }catch(e){ console.error(e); }
}
setInterval(pollRound,2000); pollRound();

document.getElementById('submitCode') && document.getElementById('submitCode').addEventListener('click', async ()=>{
  const code = document.getElementById('codeInput').value.trim();
  const number = localStorage.getItem('my_player_number');
  if(!number){ alert('No player number stored locally. Register first.'); return; }
  const resp = await fetch('/api/submit_code', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({number: Number(number), code: code})});
  const j = await resp.json();
  if(!j.ok){ alert('Error: '+(j.error||'')); return; }
  if(j.correct){ document.getElementById('resultMsg').textContent = 'Correct! Score: '+j.score; if(j.winner){ alert('Winner: '+j.winner); window.location='/finished'; } }
  else{ document.getElementById('resultMsg').textContent = 'Incorrect.'; }
});

(async function(){
  const players = await fetch('/players.json').then(r=>r.json()).catch(()=>[]);
  if(players && players.length>0 && !localStorage.getItem('my_player_number')){
    localStorage.setItem('my_player_number', players[0].number);
    alert('Assigned local player number: '+players[0].number+' (you can change localStorage key my_player_number to match your player)');
  }
})();
