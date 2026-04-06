from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import json
import random
import sqlite3
from datetime import datetime
import requests
from dotenv import load_dotenv
import bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MONGO_URI = os.getenv("MONGO_URI")

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*", "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"], "allow_headers": ["Content-Type", "Authorization"]}})

app.config["JWT_SECRET_KEY"] = "super-secret-yieldiq-key-for-jwt"
jwt = JWTManager(app)

# ===================== DATABASE SETUP =====================

# Try MongoDB first
db = None
client = None
try:
    from pymongo import MongoClient
    from bson import ObjectId
    # Try with certifi for SSL
    try:
        import certifi
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000, connectTimeoutMS=3000, tlsCAFile=certifi.where())
    except ImportError:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000, connectTimeoutMS=3000, tlsAllowInvalidCertificates=True)
    db = client.get_database('yieldiq')
    client.server_info()
    print("✅ MongoDB connected!")
except Exception as e:
    print(f"⚠️ MongoDB unavailable ({e}), using SQLite fallback")
    client = None
    db = None

# ===================== SQLite Fallback =====================

SQLITE_DB = os.path.join(os.path.dirname(__file__), 'yieldiq.db')

def get_sqlite():
    conn = sqlite3.connect(SQLITE_DB)
    conn.row_factory = sqlite3.Row
    return conn

def init_sqlite():
    conn = get_sqlite()
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT DEFAULT 'Farmer',
        phone TEXT DEFAULT '',
        password TEXT NOT NULL,
        provider TEXT DEFAULT '',
        created_at TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS listings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_id TEXT, seller_name TEXT, seller_email TEXT, seller_phone TEXT,
        crop TEXT, quantity REAL, price REAL, location TEXT,
        harvest_date TEXT, description TEXT, image TEXT,
        status TEXT DEFAULT 'active', created_at TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS offers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        listing_id TEXT, crop TEXT,
        buyer_id TEXT, buyer_name TEXT, buyer_email TEXT,
        seller_id TEXT, seller_name TEXT, seller_email TEXT,
        offer_price REAL, quantity REAL, asking_price REAL,
        counter_price REAL, status TEXT DEFAULT 'pending', created_at TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        listing_id TEXT, sender_email TEXT, sender_name TEXT,
        receiver_email TEXT, text TEXT, timestamp TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS markets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        crop TEXT, mandi TEXT, price REAL, change REAL
    )''')
    conn.commit()
    conn.close()

init_sqlite()

def serialize_doc(doc):
    if doc and '_id' in doc:
        doc['_id'] = str(doc['_id'])
    return doc

def row_to_dict(row):
    if row is None:
        return None
    return dict(row)

# ===================== AUTH =====================

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    name = data.get('name', 'Farmer')
    phone = data.get('phone', '')

    if db is not None:
        # MongoDB path
        try:
            if db.users.find_one({'email': email}):
                return jsonify({'success': False, 'message': 'User already exists'}), 400
            hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
            db.users.insert_one({
                'email': email, 'name': name, 'phone': phone,
                'password': hashed_pw.decode('utf-8'),
                'created_at': datetime.utcnow().isoformat()
            })
            return jsonify({'success': True, 'message': 'Registered successfully'})
        except Exception as e:
            print(f"MongoDB register error, falling back to SQLite: {e}")

    # SQLite fallback
    try:
        conn = get_sqlite()
        c = conn.cursor()
        c.execute('SELECT id FROM users WHERE email = ?', (email,))
        if c.fetchone():
            conn.close()
            return jsonify({'success': False, 'message': 'User already exists'}), 400
        hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        c.execute('INSERT INTO users (email, name, phone, password, created_at) VALUES (?, ?, ?, ?, ?)',
                  (email, name, phone, hashed_pw.decode('utf-8'), datetime.utcnow().isoformat()))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Registered successfully'})
    except Exception as e:
        return jsonify({'success': False, 'message': f'Registration error: {str(e)}'}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')

    if db is not None:
        try:
            user = db.users.find_one({'email': email})
            if user and bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
                token = create_access_token(identity=str(user['_id']))
                return jsonify({
                    'success': True, 'token': token,
                    'user': {
                        'id': str(user['_id']), 'name': user['name'],
                        'email': user['email'], 'phone': user.get('phone', '')
                    }
                })
            if user:
                return jsonify({'success': False, 'message': 'Invalid credentials'}), 401
        except Exception as e:
            print(f"MongoDB login error, falling back to SQLite: {e}")

    # SQLite fallback
    try:
        conn = get_sqlite()
        c = conn.cursor()
        c.execute('SELECT * FROM users WHERE email = ?', (email,))
        row = c.fetchone()
        conn.close()
        if row:
            user = row_to_dict(row)
            if bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
                token = create_access_token(identity=str(user['id']))
                return jsonify({
                    'success': True, 'token': token,
                    'user': {
                        'id': str(user['id']), 'name': user['name'],
                        'email': user['email'], 'phone': user.get('phone', '')
                    }
                })
        return jsonify({'success': False, 'message': 'Invalid credentials'}), 401
    except Exception as e:
        return jsonify({'success': False, 'message': f'Login error: {str(e)}'}), 500

@app.route('/api/auth/social', methods=['POST'])
def social_login():
    data = request.json
    provider = data.get('provider')
    email = data.get('email')
    name = data.get('name')

    user_id = 'local_' + email.replace('@', '_').replace('.', '_')
    phone = ''

    if db is not None:
        try:
            user = db.users.find_one({'email': email})
            if not user:
                insert_res = db.users.insert_one({
                    'email': email, 'name': name, 'provider': provider,
                    'created_at': datetime.utcnow().isoformat()
                })
                user_id = str(insert_res.inserted_id)
            else:
                user_id = str(user['_id'])
                phone = user.get('phone', '')
        except Exception as e:
            print(f"MongoDB social login error, falling back to SQLite: {e}")

    if user_id.startswith('local_'):
        # SQLite fallback for social login
        try:
            conn = get_sqlite()
            c = conn.cursor()
            c.execute('SELECT * FROM users WHERE email = ?', (email,))
            row = c.fetchone()
            if not row:
                c.execute('INSERT INTO users (email, name, phone, password, provider, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                          (email, name, '', 'social_auth', provider, datetime.utcnow().isoformat()))
                conn.commit()
                user_id = str(c.lastrowid)
            else:
                user = row_to_dict(row)
                user_id = str(user['id'])
                phone = user.get('phone', '')
            conn.close()
        except Exception as e:
            print(f"SQLite social login fallback error: {e}")

    token = create_access_token(identity=user_id)
    return jsonify({
        'success': True, 'token': token,
        'user': {
            'id': user_id, 'name': name,
            'email': email, 'phone': phone
        }
    })

# ===================== MARKETS (Live Gov API) =====================

@app.route('/api/markets', methods=['GET'])
def get_markets():
    datagov_key = os.getenv('DATAGOV_API_KEY')
    if datagov_key:
        try:
            import requests as req
            url = f"https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key={datagov_key}&format=json&limit=15"
            r = req.get(url, timeout=5)
            if r.status_code == 200:
                results = []
                for rec in r.json().get('records', []):
                    price = float(rec.get('modal_price', 0))
                    if price > 0:
                        results.append({
                            'crop': rec.get('commodity', '').capitalize(),
                            'mandi': f"{rec.get('market', '')}, {rec.get('state', '')}",
                            'price': int(price),
                            'change': round(random.uniform(-3.5, 3.5), 1)
                        })
                if results:
                    return jsonify(results)
        except Exception as e:
            print("Gov API Error:", e)

    if db is not None:
        try:
            markets = list(db.markets.find())
            return jsonify([serialize_doc(m) for m in markets])
        except Exception as e:
            print(f"MongoDB markets error: {e}")

    # SQLite fallback
    try:
        conn = get_sqlite()
        c = conn.cursor()
        c.execute('SELECT * FROM markets')
        rows = c.fetchall()
        conn.close()
        if rows:
            return jsonify([row_to_dict(r) for r in rows])
    except Exception as e:
        print(f"SQLite markets error: {e}")

    # Final fallback - static data
    return jsonify([
        {'crop': 'Wheat', 'mandi': 'Azadpur, Delhi', 'price': 2840, 'change': 2.4},
        {'crop': 'Rice', 'mandi': 'Vashi, Maharashtra', 'price': 3120, 'change': 1.1},
        {'crop': 'Soybean', 'mandi': 'Indore, MP', 'price': 4510, 'change': 3.2},
        {'crop': 'Cotton', 'mandi': 'Rajkot, Gujarat', 'price': 6250, 'change': -1.2},
        {'crop': 'Corn', 'mandi': 'Davangere, Karnataka', 'price': 1950, 'change': -0.8},
        {'crop': 'Mustard', 'mandi': 'Jaipur, Rajasthan', 'price': 5150, 'change': 1.5},
        {'crop': 'Onion', 'mandi': 'Nashik, Maharashtra', 'price': 1780, 'change': 4.2},
        {'crop': 'Tomato', 'mandi': 'Kolar, Karnataka', 'price': 2700, 'change': 5.1},
    ])

# ===================== CROP LISTINGS (Marketplace) =====================

@app.route('/api/listings', methods=['GET'])
def get_listings():
    if db is not None:
        try:
            listings = list(db.listings.find().sort('created_at', -1))
            for l in listings:
                l['_id'] = str(l['_id'])
            return jsonify(listings)
        except Exception as e:
            print(f"MongoDB listings error: {e}")

    # SQLite fallback
    conn = get_sqlite()
    c = conn.cursor()
    c.execute('SELECT * FROM listings ORDER BY created_at DESC')
    rows = c.fetchall()
    conn.close()
    result = []
    for r in rows:
        d = row_to_dict(r)
        d['_id'] = str(d['id'])
        result.append(d)
    return jsonify(result)

@app.route('/api/listings', methods=['POST'])
def create_listing():
    data = request.json
    listing = {
        'seller_id': data.get('seller_id', ''),
        'seller_name': data.get('seller_name', 'Unknown'),
        'seller_email': data.get('seller_email', ''),
        'seller_phone': data.get('seller_phone', ''),
        'crop': data.get('crop', ''),
        'quantity': data.get('quantity', 0),
        'price': data.get('price', 0),
        'location': data.get('location', ''),
        'harvest_date': data.get('harvest_date', ''),
        'description': data.get('description', ''),
        'image': data.get('image', ''),
        'status': 'active',
        'created_at': datetime.utcnow().isoformat()
    }

    if db is not None:
        try:
            result = db.listings.insert_one(listing)
            listing['_id'] = str(result.inserted_id)
            return jsonify({'success': True, 'listing': listing})
        except Exception as e:
            print(f"MongoDB create listing error: {e}")

    # SQLite fallback
    conn = get_sqlite()
    c = conn.cursor()
    c.execute('''INSERT INTO listings (seller_id, seller_name, seller_email, seller_phone,
              crop, quantity, price, location, harvest_date, description, image, status, created_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)''',
              (listing['seller_id'], listing['seller_name'], listing['seller_email'], listing['seller_phone'],
               listing['crop'], listing['quantity'], listing['price'], listing['location'],
               listing['harvest_date'], listing['description'], listing['image'], listing['status'], listing['created_at']))
    conn.commit()
    listing['_id'] = str(c.lastrowid)
    conn.close()
    return jsonify({'success': True, 'listing': listing})

@app.route('/api/listings/<listing_id>', methods=['DELETE'])
def delete_listing(listing_id):
    if db is not None:
        try:
            db.listings.delete_one({'_id': ObjectId(listing_id)})
            return jsonify({'success': True})
        except Exception as e:
            print(f"MongoDB delete listing error: {e}")

    # SQLite fallback
    try:
        conn = get_sqlite()
        c = conn.cursor()
        c.execute('DELETE FROM listings WHERE id = ?', (listing_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except:
        return jsonify({'success': False, 'message': 'Listing not found'}), 404

# ===================== OFFERS (Buy/Sell Negotiation) =====================

@app.route('/api/offers', methods=['POST'])
def create_offer():
    data = request.json
    offer = {
        'listing_id': data.get('listing_id'),
        'crop': data.get('crop', ''),
        'buyer_id': data.get('buyer_id', ''),
        'buyer_name': data.get('buyer_name', ''),
        'buyer_email': data.get('buyer_email', ''),
        'seller_id': data.get('seller_id', ''),
        'seller_name': data.get('seller_name', ''),
        'seller_email': data.get('seller_email', ''),
        'offer_price': data.get('offer_price', 0),
        'quantity': data.get('quantity', 0),
        'asking_price': data.get('asking_price', 0),
        'counter_price': None,
        'status': 'pending',
        'created_at': datetime.utcnow().isoformat()
    }

    if db is not None:
        try:
            result = db.offers.insert_one(offer)
            offer['_id'] = str(result.inserted_id)
            return jsonify({'success': True, 'offer': offer})
        except Exception as e:
            print(f"MongoDB create offer error: {e}")

    # SQLite fallback
    conn = get_sqlite()
    c = conn.cursor()
    c.execute('''INSERT INTO offers (listing_id, crop, buyer_id, buyer_name, buyer_email,
              seller_id, seller_name, seller_email, offer_price, quantity, asking_price,
              counter_price, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
              (offer['listing_id'], offer['crop'], offer['buyer_id'], offer['buyer_name'],
               offer['buyer_email'], offer['seller_id'], offer['seller_name'], offer['seller_email'],
               offer['offer_price'], offer['quantity'], offer['asking_price'],
               offer['counter_price'], offer['status'], offer['created_at']))
    conn.commit()
    offer['_id'] = str(c.lastrowid)
    conn.close()
    return jsonify({'success': True, 'offer': offer})

@app.route('/api/offers/user/<user_email>', methods=['GET'])
def get_user_offers(user_email):
    if db is not None:
        try:
            as_buyer = list(db.offers.find({'buyer_email': user_email}))
            as_seller = list(db.offers.find({'seller_email': user_email}))
            for o in as_buyer + as_seller:
                o['_id'] = str(o['_id'])
            return jsonify({'as_buyer': as_buyer, 'as_seller': as_seller})
        except Exception as e:
            print(f"MongoDB get offers error: {e}")

    # SQLite fallback
    conn = get_sqlite()
    c = conn.cursor()
    c.execute('SELECT * FROM offers WHERE buyer_email = ?', (user_email,))
    as_buyer = [row_to_dict(r) for r in c.fetchall()]
    for o in as_buyer:
        o['_id'] = str(o['id'])
    c.execute('SELECT * FROM offers WHERE seller_email = ?', (user_email,))
    as_seller = [row_to_dict(r) for r in c.fetchall()]
    for o in as_seller:
        o['_id'] = str(o['id'])
    conn.close()
    return jsonify({'as_buyer': as_buyer, 'as_seller': as_seller})

@app.route('/api/offers/<offer_id>/accept', methods=['POST'])
def accept_offer_new(offer_id):
    if db is not None:
        try:
            db.offers.update_one({'_id': ObjectId(offer_id)}, {'$set': {'status': 'accepted'}})
            return jsonify({'success': True})
        except Exception as e:
            print(f"MongoDB accept offer error: {e}")

    try:
        conn = get_sqlite()
        c = conn.cursor()
        c.execute('UPDATE offers SET status = ? WHERE id = ?', ('accepted', offer_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except:
        return jsonify({'success': False}), 400

@app.route('/api/offers/<offer_id>/reject', methods=['POST'])
def reject_offer(offer_id):
    if db is not None:
        try:
            db.offers.update_one({'_id': ObjectId(offer_id)}, {'$set': {'status': 'rejected'}})
            return jsonify({'success': True})
        except Exception as e:
            print(f"MongoDB reject offer error: {e}")

    try:
        conn = get_sqlite()
        c = conn.cursor()
        c.execute('UPDATE offers SET status = ? WHERE id = ?', ('rejected', offer_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except:
        return jsonify({'success': False}), 400

@app.route('/api/offers/<offer_id>/counter', methods=['POST'])
def counter_offer_new(offer_id):
    data = request.json
    counter_price = data.get('counter_price', 0)

    if db is not None:
        try:
            db.offers.update_one({'_id': ObjectId(offer_id)}, {
                '$set': {'counter_price': counter_price, 'status': 'countered'}
            })
            return jsonify({'success': True})
        except Exception as e:
            print(f"MongoDB counter offer error: {e}")

    try:
        conn = get_sqlite()
        c = conn.cursor()
        c.execute('UPDATE offers SET counter_price = ?, status = ? WHERE id = ?', (counter_price, 'countered', offer_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except:
        return jsonify({'success': False}), 400

# ===================== CHAT (Buyer-Seller Messaging) =====================

@app.route('/api/chat/send', methods=['POST'])
def send_chat():
    data = request.json
    message = {
        'listing_id': data.get('listing_id', ''),
        'sender_email': data.get('sender_email', ''),
        'sender_name': data.get('sender_name', ''),
        'receiver_email': data.get('receiver_email', ''),
        'text': data.get('text', ''),
        'timestamp': datetime.utcnow().isoformat()
    }

    if db is not None:
        try:
            db.chats.insert_one(message)
            return jsonify({'success': True})
        except Exception as e:
            print(f"MongoDB chat send error: {e}")

    # SQLite fallback
    conn = get_sqlite()
    c = conn.cursor()
    c.execute('INSERT INTO chats (listing_id, sender_email, sender_name, receiver_email, text, timestamp) VALUES (?,?,?,?,?,?)',
              (message['listing_id'], message['sender_email'], message['sender_name'],
               message['receiver_email'], message['text'], message['timestamp']))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/chat/<listing_id>/<user1>/<user2>', methods=['GET'])
def get_chat(listing_id, user1, user2):
    if db is not None:
        try:
            messages = list(db.chats.find({
                'listing_id': listing_id,
                '$or': [
                    {'sender_email': user1, 'receiver_email': user2},
                    {'sender_email': user2, 'receiver_email': user1}
                ]
            }).sort('timestamp', 1))
            for m in messages:
                m['_id'] = str(m['_id'])
            return jsonify(messages)
        except Exception as e:
            print(f"MongoDB chat get error: {e}")

    # SQLite fallback
    conn = get_sqlite()
    c = conn.cursor()
    c.execute('''SELECT * FROM chats WHERE listing_id = ? AND
              ((sender_email = ? AND receiver_email = ?) OR (sender_email = ? AND receiver_email = ?))
              ORDER BY timestamp ASC''', (listing_id, user1, user2, user2, user1))
    rows = c.fetchall()
    conn.close()
    result = []
    for r in rows:
        d = row_to_dict(r)
        d['_id'] = str(d['id'])
        result.append(d)
    return jsonify(result)

# ===================== AI (Chatbot & Predictions) =====================

@app.route('/api/ai/chat', methods=['POST'])
def ai_chat():
    if not GEMINI_API_KEY:
        return jsonify({'response': '❌ Gemini API key is missing.'})

    data = request.json
    msg = data.get('message', '')
    weather = data.get('weather', {})
    lang = data.get('lang', 'en')
    lang_name = {'en':'English', 'hi':'Hindi', 'kn':'Kannada'}.get(lang, 'English')

    try:
        prompt = f"""You are YieldIQ Assistant, an expert AI for Indian farmers. 
Keep your answers brief, friendly, and use emojis.
The farmer's current local weather is: {weather}.
Do not mention that you are an AI model developed by Google.
IMPORTANT: You MUST reply in the {lang_name} language.
Farmer says: {msg}"""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
        payload = {"contents": [{"parts": [{"text": prompt}]}]}
        res = requests.post(url, json=payload)
        
        if res.status_code == 200:
            text = res.json().get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
            return jsonify({'response': text.replace('*', '')})
        else:
            return jsonify({'response': f'❌ AI API Error: {res.status_code}'})
    except Exception as e:
        return jsonify({'response': f'❌ AI Error: {str(e)}'})

@app.route('/api/ai/predict', methods=['POST'])
def ai_predict():
    if not GEMINI_API_KEY:
        return jsonify({'error': 'Gemini API key missing.'}), 500

    data = request.json
    crop = data.get('crop')
    area = data.get('area')
    state = data.get('state')
    weather_data = data.get('weather', {})
    lang = data.get('lang', 'en')
    lang_name = {'en':'English', 'hi':'Hindi', 'kn':'Kannada'}.get(lang, 'English')

    try:
        prompt = f"""You are an agricultural commodity market predictor for India.
Calculate expected yield and revenue for a farmer.
Crop: {crop}
Area: {area} Acres
State: {state}
7-Day Weather Data: {weather_data}

Provide an analysis in this exact JSON format (keep JSON keys in English, but output all string values in {lang_name} language), NO backticks, NO markdown, just the raw JSON:
{{
  "predicted_price_qtl": 3000,
  "trend": "up",
  "est_yield_qtl": 45,
  "est_revenue": 135000,
  "confidence_pct": 85,
  "best_time": "Next Week",
  "best_mandi": "Azadpur, Delhi",
  "weather_risk_label": "🟢 Low Risk",
  "weather_risk_color": "var(--secondary)",
  "recommendation_html": "Sell at Azadpur within the next week. Good rainfall supports higher yields."
}}"""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
        payload = {"contents": [{"parts": [{"text": prompt}]}]}
        res = requests.post(url, json=payload)
        
        if res.status_code == 200:
            text = res.json().get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
            text = text.strip().replace('```json', '').replace('```', '')
            return jsonify(json.loads(text))
        else:
            return jsonify({'error': f'AI API Error: {res.status_code}'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===================== LEGACY ENDPOINTS (kept for backward compat) =====================

@app.route('/api/buyers', methods=['GET'])
def get_buyers():
    if db is not None:
        try:
            buyers = list(db.buyers.find())
            return jsonify([serialize_doc(b) for b in buyers])
        except Exception as e:
            print(f"MongoDB buyers error: {e}")
    return jsonify([])

@app.route('/api/negotiations', methods=['GET'])
def get_negotiations():
    if db is not None:
        try:
            negotiations = list(db.negotiations.find())
            return jsonify([serialize_doc(n) for n in negotiations])
        except Exception as e:
            print(f"MongoDB negotiations error: {e}")
    return jsonify([])

@app.route('/api/translate', methods=['POST'])
def proxy_translate():
    data = request.json
    texts = data.get('q', [])
    target = data.get('target', 'hi')
    source = data.get('source', 'en')
    
    if target == 'en' or not texts:
        return jsonify({'translatedText': texts})
        
    # Instantly route to Robust Fallback (Free Google Translate API - Batched via POST + newline)
    translated = []
    import re
    import urllib.parse
    
    # We join with a newline allowing multiple sequential text blocks in one rapid POST payload
    joined_text = "\n".join(texts)
    gtx_url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl={source}&tl={target}&dt=t"
    try:
        # Use POST to override length limits and allow one massive lightning-fast fetch
        res = requests.post(gtx_url, data={'q': joined_text}, timeout=10)
        if res.status_code == 200:
            res_data = res.json()
            t_text = "".join([segment[0] for segment in res_data[0] if segment[0]])
            chunks = t_text.split('\n')
            
            for i, chunk in enumerate(chunks):
                if i < len(texts):
                    orig = texts[i]
                    # Perfect UI/UX formatting preservation (keep identical leading/trailing spaces)
                    leading_match = re.match(r'^([\s\n]+)', orig)
                    trailing_match = re.search(r'([\s\n]+)$', orig)
                    leading = leading_match.group(1) if leading_match else ""
                    trailing = trailing_match.group(1) if trailing_match else ""
                    translated.append(leading + chunk.strip() + trailing)
                else:
                    translated.append(chunk)
            
            # Padding fallback
            if len(translated) < len(texts):
                translated.extend(texts[len(translated):])
            translated = translated[:len(texts)]
        else:
            translated = texts
    except Exception as e:
        translated = texts

    return jsonify({'translatedText': translated})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
