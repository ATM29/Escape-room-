
from flask import Flask, render_template, request, jsonify, redirect, url_for
import os, json, time, random, hashlib
import pandas as pd

app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = os.environ.get('FLASK_SECRET','change-me')

BASE = os.path.dirname(__file__)
DATA_XLSX = os.path.join(BASE, 'static', 'data', 'Names for team building.xlsx')
PLAYERS_PATH = os.path.join(BASE, 'players.json')
SESSION_PATH = os.path.join(BASE, 'session.json')
LEADER_PATH = os.path.join(BASE, 'leaderboard.json')

ROUND_INTERVAL = 90  # seconds per round
ROUND_SIZE = 6
WIN_SCORE = 5

def load_excel():
    if not os.path.exists(DATA_XLSX):
        return None
    df = pd.read_excel(DATA_XLSX, engine='openpyxl', dtype=str)
    df.columns = [c.strip() for c in df.columns]
    cols = {c.lower(): c for c in df.columns}
    if 'id' not in cols or 'name' not in cols or ('reporting to' not in cols and 'manager' not in cols):
        return None
    manager_col = cols.get('reporting to') or cols.get('manager')
    df = df.rename(columns={cols['id']:'ID', cols['name']:'Name', manager_col:'Reporting to'})
    df['Reporting to'] = df['Reporting to'].astype(str).str.strip()
    df['ID'] = df['ID'].astype(str).str.strip()
    return df[['ID','Name','Reporting to']].dropna()

def save_json(path, obj):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)

def load_json(path):
    if not os.path.exists(path):
        return None
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

@app.route('/')
def index():
    return redirect(url_for('register_get'))

@app.route('/register', methods=['GET'])
def register_get():
    df = load_excel()
    if df is None:
        return "Excel file missing or invalid. Place 'Names for team building.xlsx' into static/data/ with columns: ID, Name, Reporting to (or Manager).", 500
    managers = sorted(set(df['Reporting to'].dropna().tolist()))
    return render_template('register.html', managers=managers)

@app.route('/register', methods=['POST'])
def register_post():
    payload = request.get_json() or {}
    players_in = payload.get('players', [])
    df = load_excel()
    if df is None:
        return jsonify({'ok':False,'error':'excel_missing'}),400
    saved = []
    for p in players_in:
        entered_id = str(p.get('id','')).strip()
        manager = p.get('manager','')
        match = df[(df['ID']==entered_id) & (df['Reporting to']==manager)]
        if match.empty:
            return jsonify({'ok':False,'error':'invalid_id_or_manager','id':entered_id,'manager':manager}),400
        h = hashlib.sha1(entered_id.encode('utf-8')).hexdigest()
        digit = int(h[:8],16) % 10
        number = int(h[8:16],16) % 9000 + 1000
        saved.append({'id': entered_id, 'name': match.iloc[0]['Name'], 'manager': manager, 'digit': digit, 'number': number, 'score':0})
    save_json(PLAYERS_PATH, saved)
    return jsonify({'ok':True,'players':saved})

@app.route('/welcome_after_register')
def welcome_after_register():
    return render_template('welcome_after_register.html')

@app.route('/start_session', methods=['POST'])
def start_session():
    players = load_json(PLAYERS_PATH) or []
    df = load_excel()
    if df is None:
        return jsonify({'ok':False,'error':'excel_missing'}),400
    chosen_managers = set(p.get('manager') for p in players if p.get('manager'))
    excluded_ids = df[df['Reporting to'].isin(chosen_managers)]['ID'].astype(str).tolist()
    excluded_ids += [p['id'] for p in players]
    pool_ids = df[~df['ID'].isin(excluded_ids)][['ID','Name']].astype(str).values.tolist()  # list of [ID,Name]
    # shuffle deterministically
    start_time = int(time.time())
    rng = random.Random(start_time)
    rng.shuffle(pool_ids)
    rounds = []
    if len(pool_ids)==0:
        rounds = []
    else:
        idx = 0
        while len(rounds) < 500:
            chunk = []
            for _ in range(ROUND_SIZE):
                item = pool_ids[idx % len(pool_ids)]
                chunk.append({'id': item[0], 'name': item[1]})
                idx += 1
            rounds.append(chunk)
    session = {'start_time': start_time, 'rounds': rounds, 'interval': ROUND_INTERVAL}
    save_json(SESSION_PATH, session)
    return jsonify({'ok':True,'start_time':start_time})

@app.route('/game')
def game_page():
    return render_template('game.html')

@app.route('/api/current_round')
def api_current_round():
    sess = load_json(SESSION_PATH) or {}
    if not sess or 'rounds' not in sess or len(sess['rounds'])==0:
        return jsonify({'ok':False,'error':'no_session_or_empty_pool'}),404
    now = int(time.time())
    elapsed = now - sess['start_time']
    interval = sess.get('interval', ROUND_INTERVAL)
    idx = int((elapsed // interval) % len(sess['rounds']))
    time_into = elapsed % interval
    time_left = int(interval - time_into)
    # return names for display and ids for verification
    round_chunk = sess['rounds'][idx]
    names = [r['name'] for r in round_chunk]
    ids = [r['id'] for r in round_chunk]
    return jsonify({'ok':True, 'round_index': idx, 'ids': ids, 'names': names, 'time_left': time_left})

@app.route('/api/submit_code', methods=['POST'])
def api_submit_code():
    data = request.get_json() or {}
    player_number = int(data.get('number') or 0)
    code = str(data.get('code') or '').strip()
    players = load_json(PLAYERS_PATH) or []
    player = next((p for p in players if int(p.get('number'))==int(player_number)), None)
    if not player:
        return jsonify({'ok':False,'error':'player_not_found'}),404
    sess = load_json(SESSION_PATH) or {}
    if not sess or 'rounds' not in sess:
        return jsonify({'ok':False,'error':'no_session'}),400
    now = int(time.time())
    elapsed = now - sess['start_time']
    interval = sess.get('interval', ROUND_INTERVAL)
    idx = int((elapsed // interval) % len(sess['rounds']))
    time_into = elapsed % interval
    time_left = int(interval - time_into)
    if time_left <= 0:
        return jsonify({'ok':False,'error':'time_over'}),400
    current_ids = [r['id'] for r in sess['rounds'][idx]]
    def digit_of_id(idstr):
        h = hashlib.sha1(idstr.encode('utf-8')).hexdigest()
        return str(int(h[:8],16) % 10)
    correct = ''.join(digit_of_id(i) for i in current_ids)
    if len(code) != len(correct):
        return jsonify({'ok':False,'error':'bad_length','expected_length':len(correct)}),400
    if code == correct:
        for p in players:
            if int(p.get('number'))==int(player_number):
                p['score'] = p.get('score',0) + 1
                score = p['score']
                break
        save_json(PLAYERS_PATH, players)
        winner = None
        if score >= WIN_SCORE:
            winner = p.get('name')
            lb = load_json(LEADER_PATH) or []
            elapsed_total = int(time.time()) - sess['start_time']
            lb.append({'name': winner, 'time': elapsed_total})
            lb = sorted(lb, key=lambda x: x['time'])[:100]
            save_json(LEADER_PATH, lb)
        return jsonify({'ok':True,'correct':True,'score':score,'winner':winner})
    else:
        return jsonify({'ok':True,'correct':False,'score':player.get('score',0)})

@app.route('/players.json')
def players_json():
    return json.dumps(load_json(PLAYERS_PATH) or [])

@app.route('/leaderboard.json')
def leaderboard_json():
    return json.dumps(load_json(LEADER_PATH) or [])

@app.route('/save_score', methods=['POST'])
def save_score():
    data = request.get_json() or {}
    name = data.get('name','Anon')[:32]
    time_sec = int(data.get('time') or 0)
    lb = load_json(LEADER_PATH) or []
    lb.append({'name': name, 'time': time_sec})
    lb = sorted(lb, key=lambda x: x['time'])[:100]
    save_json(LEADER_PATH, lb)
    return jsonify({'ok':True})

@app.route('/finished')
def finished():
    return render_template('finished.html')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
