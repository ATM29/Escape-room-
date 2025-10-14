
from flask import Flask, render_template, request, jsonify, redirect, url_for, session
import os, json, time, random, hashlib
import pandas as pd

app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = os.environ.get('FLASK_SECRET','change-me')

BASE = os.path.dirname(__file__)
DATA_XLSX = os.path.join(BASE, 'static', 'data', 'Names for team building.xlsx')
PLAYERS_PATH = os.path.join(BASE, 'players.json')
SESSION_PATH = os.path.join(BASE, 'session.json')
LEADER_PATH = os.path.join(BASE, 'leaderboard.json')  # root leaderboard

# reset leaderboard on app start to keep current-session only
if not os.path.exists(LEADER_PATH):
    with open(LEADER_PATH, 'w', encoding='utf-8') as f:
        json.dump([], f, ensure_ascii=False, indent=2)
else:
    # truncate to empty to enforce current-session-only behavior
    with open(LEADER_PATH, 'w', encoding='utf-8') as f:
        json.dump([], f, ensure_ascii=False, indent=2)

ROUND_INTERVAL = 240  # seconds (4 minutes)
ROUND_SIZE = 4  # 4 players per round
WIN_SCORE = 1  # not used, single-run win when succeed

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
    # also store player's session info
    session['registered'] = True
    session['player'] = saved[0]
    return jsonify({'ok':True,'players':saved})

@app.route('/welcome_after_register')
def welcome_after_register():
    if not session.get('registered'):
        return redirect(url_for('register_get'))
    return render_template('welcome_after_register.html')

@app.route('/start_session', methods=['POST'])
def start_session():
    if not session.get('registered'):
        return jsonify({'ok':False,'error':'not_registered'}),400
    df = load_excel()
    if df is None:
        return jsonify({'ok':False,'error':'excel_missing'}),400
    player = session.get('player')
    chosen_manager = player.get('manager')
    # exclude player's manager team and the player themself
    excluded_ids = df[df['Reporting to']==chosen_manager]['ID'].astype(str).tolist()
    excluded_ids += [player['id']]
    pool = df[~df['ID'].isin(excluded_ids)][['ID','Name']].astype(str).values.tolist()
    if len(pool) == 0:
        return jsonify({'ok':False,'error':'no_pool'}),400
    rng = random.Random(int(time.time()))
    rng.shuffle(pool)
    selected = []
    for i in range(ROUND_SIZE):
        item = pool[i % len(pool)]
        selected.append({'id': item[0], 'name': item[1], 'code': rng.randint(0,9)})  # plaintext code stored here transiently
    # store hashed codes in session and names
    codes_hashed = {s['id']: hashlib.sha256(str(s['code']).encode()).hexdigest() for s in selected}
    # Also store plaintext to show to players? No — only display names. The real players (physical people) will tell the main player their code.
    session['game'] = {'start_time': int(time.time()), 'interval': ROUND_INTERVAL, 'round': selected, 'codes_hashed': codes_hashed, 'solved': {s['id']: False for s in selected}}
    save_json(SESSION_PATH, session['game'])
    return jsonify({'ok':True,'start_time': session['game']['start_time']})

@app.route('/game')
def game_page():
    if not session.get('game'):
        return redirect(url_for('register_get'))
    return render_template('game.html')

@app.route('/api/current_round')
def api_current_round():
    g = session.get('game')
    if not g:
        return jsonify({'ok':False,'error':'no_session'}),404
    now = int(time.time())
    elapsed = now - g['start_time']
    if elapsed >= g['interval']:
        return jsonify({'ok':False,'error':'time_over'}),400
    time_left = int(g['interval'] - elapsed)
    names = [r['name'] for r in g['round']]
    ids = [r['id'] for r in g['round']]
    return jsonify({'ok':True, 'names': names, 'ids': ids, 'time_left': time_left})

@app.route('/api/submit_digit', methods=['POST'])
def api_submit_digit():
    data = request.get_json() or {}
    entered = str(data.get('digit','')).strip()
    target_id = str(data.get('id','')).strip()
    g = session.get('game')
    if not g:
        return jsonify({'ok':False,'error':'no_session'}),400
    # check time
    now = int(time.time())
    elapsed = now - g['start_time']
    if elapsed >= g['interval']:
        return jsonify({'ok':False,'error':'time_over'}),400
    # validate target exists in current round
    if target_id not in [r['id'] for r in g['round']]:
        return jsonify({'ok':False,'error':'invalid_target'}),400
    hashed = hashlib.sha256(entered.encode()).hexdigest()
    expected = g['codes_hashed'].get(target_id)
    if hashed == expected:
        g['solved'][target_id] = True
        session['game'] = g
        save_json(SESSION_PATH, g)
        # check win
        if all(g['solved'].values()):
            # compute elapsed total
            total = int(time.time()) - g['start_time']
            # save to leaderboard root file
            lb = load_json(LEADER_PATH) or []
            player = session.get('player') or {}
            lb.append({'name': player.get('name','Anon'), 'manager': player.get('manager',''), 'result':'Win', 'time': total})
            save_json(LEADER_PATH, lb)
            # clear session game (but keep registered)
            session.pop('game', None)
            return jsonify({'ok':True,'status':'win','time': total})
        return jsonify({'ok':True,'status':'correct'})
    else:
        return jsonify({'ok':False,'error':'incorrect'}),400

@app.route('/api/time_left')
def api_time_left():
    g = session.get('game')
    if not g:
        return jsonify({'ok':False,'error':'no_session'}),404
    now = int(time.time())
    elapsed = now - g['start_time']
    time_left = max(0, int(g['interval'] - elapsed))
    return jsonify({'ok':True,'time_left': time_left})

@app.route('/api/reset_round', methods=['POST'])
def api_reset_round():
    # reset the round (used when time over or manual reset). Generates new 4 players and codes
    if not session.get('registered'):
        return jsonify({'ok':False,'error':'not_registered'}),400
    df = load_excel()
    player = session.get('player')
    chosen_manager = player.get('manager')
    excluded_ids = df[df['Reporting to']==chosen_manager]['ID'].astype(str).tolist()
    excluded_ids += [player['id']]
    pool = df[~df['ID'].isin(excluded_ids)][['ID','Name']].astype(str).values.tolist()
    if len(pool) == 0:
        return jsonify({'ok':False,'error':'no_pool'}),400
    rng = random.Random(int(time.time()))
    rng.shuffle(pool)
    selected = []
    for i in range(ROUND_SIZE):
        item = pool[i % len(pool)]
        selected.append({'id': item[0], 'name': item[1], 'code': rng.randint(0,9)})
    codes_hashed = {s['id']: hashlib.sha256(str(s['code']).encode()).hexdigest() for s in selected}
    session['game'] = {'start_time': int(time.time()), 'interval': ROUND_INTERVAL, 'round': selected, 'codes_hashed': codes_hashed, 'solved': {s['id']: False for s in selected}}
    save_json(SESSION_PATH, session['game'])
    return jsonify({'ok':True})

@app.route('/leaderboard')
def leaderboard_page():
    lb = load_json(LEADER_PATH) or []
    # sort by time ascending, wins first
    lb_sorted = sorted(lb, key=lambda x: (0 if x.get('result')=='Win' else 1, x.get('time',99999)))
    return render_template('leaderboard.html', leaderboard=lb_sorted)

@app.route('/players.json')
def players_json():
    return json.dumps(load_json(PLAYERS_PATH) or [])

@app.route('/save_score', methods=['POST'])
def save_score():
    data = request.get_json() or {}
    name = data.get('name','Anon')[:32]
    time_sec = int(data.get('time') or 0)
    lb = load_json(LEADER_PATH) or []
    lb.append({'name': name, 'manager': '', 'result':'Win', 'time': time_sec})
    save_json(LEADER_PATH, lb)
    return jsonify({'ok':True})

@app.route('/finished')
def finished():
    return render_template('finished.html')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
