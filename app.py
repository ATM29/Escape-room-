
from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import time, os
app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = os.environ.get('FLASK_SECRET','change-me')
ANSWERS = {
  "room1":"fingerprint","room2":"evidence","room3":"contradiction","room4":"note",
  "room5":"7291","room6":"admit","room7":"keyhole","room8":"shadow",
  "room9":"2468","room10":"reckon","room11":"ledger","room12":"expose"
}
ORDER = list(ANSWERS.keys())
HINT_ELIGIBLE = {"room2","room9","room10","room12"}
ROOM_TITLES = {
  "room1":"Study","room2":"Archive","room3":"Interrogation","room4":"Notebook",
  "room5":"Lab","room6":"Locker","room7":"Basement","room8":"Alley",
  "room9":"Vault","room10":"Final","room11":"Gallery","room12":"Confrontation"
}
ROOM_PROMPTS = {
 "room1":"Portrait crooked; note reads: 'Left behind at every touch.' (What is it?)",
 "room2":"Cipher: MJ QQFYNJ MJ GZXXJ? (ROT-6 then uppercase; searching allowed.)",
 "room3":"Two witnesses say 9pm; one says 10pm. What's the inconsistency?",
 "room4":"A small note reads: NOTE. Enter that word to proceed.",
 "room5":"Locker: 7 - 2 - ? - 1 with note: 'mirror the middle pair'.",
 "room6":"Clerk's torn line: 'I had to ___.' (one word).",
 "room7":"Torn letters 'K Y H O L E' around a key drawing. Reconstruct.",
 "room8":"Riddle: 'I follow when you walk, I shrink at noon, I stretch at dusk.'",
 "room9":"Sort items into boxes: Broken Glass (Physical), Email Log (Digital), Witness Note (Logic). Correct sorting reveals code.",
 "room10":"Final: Use initials from key solved rooms to form the final truth.",
 "room11":"A ledger page shows the word LEDGER hidden among numbers. Type LEDGER.",
 "room12":"Confrontation: Say the word that reveals the scheme."
}

@app.route('/')
def index():
    session.setdefault('progress', {r: False for r in ORDER})
    session.setdefault('started_at', None)
    session.setdefault('hint_coins', 0)
    main_content = render_template('fragment_index.html', progress=session['progress'])
    return render_template('base.html', main_content=main_content, coins=session.get('hint_coins',0))

@app.route('/room/<name>')
def room_full(name):
    if name not in ORDER: return redirect(url_for('index'))
    progress = session.get('progress', {r: False for r in ORDER})
    idx = ORDER.index(name)
    if idx>0 and not progress[ORDER[idx-1]]: return redirect(url_for('index'))
    if session.get('started_at') is None and name==ORDER[0]:
        session['started_at'] = int(time.time())
    hints_allowed = name in HINT_ELIGIBLE
    main_content = render_template('fragment.html', room=name, room_names=ROOM_TITLES, prompts=ROOM_PROMPTS, progress=progress, hints_allowed=hints_allowed)
    return render_template('base.html', main_content=main_content, coins=session.get('hint_coins',0))

@app.route('/fragment/<name>')
def fragment(name):
    if name == 'index':
        return render_template('fragment_index.html', progress=session.get('progress', {r:False for r in ORDER}))
    if name not in ORDER: return "", 404
    progress = session.get('progress', {r: False for r in ORDER})
    hints_allowed = name in HINT_ELIGIBLE
    return render_template('fragment.html', room=name, room_names=ROOM_TITLES, prompts=ROOM_PROMPTS, progress=progress, hints_allowed=hints_allowed)

@app.route('/submit', methods=['POST'])
def submit():
    room = request.form.get('room','')
    answer = (request.form.get('answer') or '').strip().lower()
    progress = session.get('progress', {r: False for r in ORDER})
    correct = False
    if room in ANSWERS:
        correct = (answer == ANSWERS[room].lower())
    if correct:
        if not progress.get(room):
            session['hint_coins'] = session.get('hint_coins',0)+1
        progress[room] = True
        session['progress'] = progress
        if all(progress.values()):
            started = session.get('started_at'); ended = int(time.time()); elapsed = ended-started if started else 0
            session.setdefault('finished_times', []).append(elapsed)
        return render_template('success_fragment.html', room=room, progress=progress, coins=session.get('hint_coins',0))
    else:
        session['fails'] = session.get('fails',0)+1
        return render_template('fail_fragment.html', room=room, attempt=answer, progress=progress, coins=session.get('hint_coins',0))

@app.route('/use_hint', methods=['POST'])
def use_hint():
    data = request.get_json() or {}
    room = data.get('room',''); level = int(data.get('level',1))
    coins = session.get('hint_coins',0)
    if coins<=0: return jsonify({'ok':False,'error':'no_coins','coins':coins}), 400
    if room not in HINT_ELIGIBLE: return jsonify({'ok':False,'error':'not_allowed','coins':coins}), 400
    session['hint_coins'] = coins-1; session['hints_used'] = session.get('hints_used',0)+1
    return jsonify({'ok':True,'coins':session['hint_coins'],'level':level})

@app.route('/api/status')
def api_status():
    return jsonify({'progress': session.get('progress', {}), 'hint_coins': session.get('hint_coins',0)})

@app.route('/reset')
def reset():
    session.pop('progress', None); session.pop('started_at', None); session.pop('hints_used', None); session.pop('fails', None); session['hint_coins'] = 0
    return redirect(url_for('index'))

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
