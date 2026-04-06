import sqlite3

def init_db():
    conn = sqlite3.connect('yieldiq.db')
    c = conn.cursor()

    # Create tables
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS markets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            crop TEXT NOT NULL,
            mandi TEXT NOT NULL,
            price INTEGER NOT NULL,
            change REAL NOT NULL
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS buyers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            crop TEXT NOT NULL,
            location TEXT NOT NULL,
            rating REAL NOT NULL,
            icon TEXT NOT NULL
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS negotiations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            buyer TEXT NOT NULL,
            crop TEXT NOT NULL,
            buyerPrice INTEGER NOT NULL,
            marketPrice INTEGER NOT NULL,
            status TEXT NOT NULL,
            counterPrice INTEGER
        )
    ''')

    # Seed initial data
    # Demo User
    c.execute('INSERT OR IGNORE INTO users (email, password, name) VALUES ("farmer@india.com", "yield123", "Farmer")')

    # Seed Market Data
    c.execute('DELETE FROM markets') # Clear existing for fresh seed
    market_data = [
        ('Wheat', 'Azadpur, Delhi', 2840, 2.4),
        ('Wheat', 'Amritsar, Punjab', 2810, 1.8),
        ('Rice (Basmati)', 'Karnal, Haryana', 3120, 1.1),
        ('Rice', 'Lucknow, UP', 2950, -0.5),
        ('Corn', 'Indore, MP', 1950, -0.8),
        ('Soybean', 'Latur, MH', 4510, 3.5),
        ('Cotton', 'Rajkot, Gujarat', 6200, -1.2),
        ('Sugarcane', 'Kolhapur, MH', 350, 0.5),
        ('Onion', 'Nashik, MH', 1800, -3.1),
        ('Mustard', 'Jaipur, RJ', 5100, 2.8),
        ('Tomato', 'Kolar, KA', 2200, 5.2),
        ('Potato', 'Agra, UP', 1400, -1.5),
    ]
    c.executemany('INSERT INTO markets (crop, mandi, price, change) VALUES (?, ?, ?, ?)', market_data)

    # Seed Buyers Data
    c.execute('DELETE FROM buyers')
    buyers_data = [
        ('ITC Agri Business', 'Corporate Buyer', 'Wheat, Rice', 'Kolkata, WB', 4.8, 'ph-buildings'),
        ('Reliance Fresh', 'Retail Chain', 'Vegetables, Fruits', 'Mumbai, MH', 4.7, 'ph-storefront'),
        ('Cargill India', 'Export House', 'Soybean, Corn', 'Gurgaon, HR', 4.9, 'ph-globe-hemisphere-west'),
        ('Adani Wilmar', 'FMCG', 'Mustard, Soybean', 'Ahmedabad, GJ', 4.6, 'ph-factory'),
        ('BigBasket', 'Online Retailer', 'All Vegetables', 'Bangalore, KA', 4.5, 'ph-shopping-cart'),
        ('Mother Dairy', 'Co-operative', 'Fruits, Vegetables', 'Delhi', 4.7, 'ph-leaf'),
    ]
    c.executemany('INSERT INTO buyers (name, type, crop, location, rating, icon) VALUES (?, ?, ?, ?, ?, ?)', buyers_data)

    # Seed Negotiations
    c.execute('DELETE FROM negotiations')
    negotiations_data = [
        ('ITC Agri Business', 'Wheat', 2750, 2840, 'open'),
        ('Cargill India', 'Soybean', 4400, 4510, 'open'),
        ('Reliance Fresh', 'Onion', 1700, 1800, 'open'),
        ('Adani Wilmar', 'Mustard', 5000, 5100, 'open')
    ]
    c.executemany('INSERT INTO negotiations (buyer, crop, buyerPrice, marketPrice, status) VALUES (?, ?, ?, ?, ?)', negotiations_data)

    conn.commit()
    conn.close()
    print("Database initialized and mock data seeded successfully.")

if __name__ == '__main__':
    init_db()
