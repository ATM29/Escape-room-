
async function fetchJSON(path, opts){ const r = await fetch(path, opts); if(!r.ok) return null; return await r.json(); }
async function refreshRound(){
  const j = await fetchJSON('/api/current_round');
  const namesEl = document.getElementById('names');
  const inputsEl = document.getElementById('inputs');
  const timeEl = document.getElementById('time_left');
  const resultEl = document.getElementById('result');
  if(!j || !j.ok){ namesEl.textContent='Waiting for round...'; inputsEl.innerHTML=''; return; }
  namesEl.innerHTML = j.names.map((n,i)=> (i+1)+'. '+n).join('<br/>');
  timeEl.textContent = j.time_left;
  // build inputs if not present
  if(inputsEl.innerHTML.trim()===''){
    inputsEl.innerHTML = j.ids.map((id,i)=> `<div style="margin-top:8px">${j.names[i]} <input data-id="${id}" maxlength="1" size="1" class="digit"> <button data-id="${id}" class="checkBtn">Check</button> <span class="status" id="s-${id}"></span></div>`).join('');
    document.querySelectorAll('.checkBtn').forEach(b=> b.addEventListener('click', async (ev)=>{
      const id = b.dataset.id || ev.target.dataset.id;
      const input = document.querySelector('input[data-id="'+id+'"]').value.trim();
      if(!input){ alert('Enter a digit'); return; }
      const resp = await fetchJSON('/api/submit_digit', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id:id,digit: input})});
      if(resp && resp.ok){
        if(resp.status==='win'){ location.href='/finished?status=win'; return; }
        document.getElementById('s-'+id).textContent = '✔';
      } else {
        alert('Incorrect digit or error'); document.getElementById('s-'+id).textContent = '✖';
      }
    }));
  }
}

setInterval(async ()=>{
  const t = await fetch('/api/time_left').then(r=>r.json()).catch(()=>null);
  if(t && t.ok){
    document.getElementById('time_left').textContent = t.time_left;
    if(t.time_left<=0){
      // time over, reset round and redirect to finished
      await fetch('/api/reset_round', {method:'POST'});
      location.href='/finished?status=timeout';
    }
  }
  refreshRound();
}, 1500);
document.getElementById('resetBtn') && document.getElementById('resetBtn').addEventListener('click', async ()=>{ await fetch('/api/reset_round', {method:'POST'}); alert('Names reset'); location.reload(); });
