import os
from pymongo import MongoClient
from dotenv import load_dotenv
import bcrypt

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")

if not MONGO_URI:
    print("❌ Error: MONGO_URI is not set in the environment.")
    exit(1)

try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    # Test connection
    client.server_info()
    print("✅ Successfully connected to MongoDB Atlas!")
    
    db = client.get_database('yieldiq')
    
    print("Clearing old collections...")
    db.users.drop()
    db.markets.drop()
    db.buyers.drop()
    db.negotiations.drop()
    
    print("Seeding Users...")
    hashed_password = bcrypt.hashpw('yield123'.encode('utf-8'), bcrypt.gensalt())
    db.users.insert_one({
        "email": "farmer@india.com",
        "name": "Siddus",
        "password": hashed_password.decode('utf-8')
    })
    
    print("Seeding Markets...")
    markets_data = [
        {'crop': 'Wheat', 'mandi': 'Azadpur, Delhi', 'price': 2840, 'change': 2.4},
        {'crop': 'Rice', 'mandi': 'Karnal, Haryana', 'price': 3120, 'change': 1.1},
        {'crop': 'Corn', 'mandi': 'Indore, MP', 'price': 1950, 'change': -0.8},
        {'crop': 'Soybean', 'mandi': 'Latur, MH', 'price': 4510, 'change': 3.5},
        {'crop': 'Cotton', 'mandi': 'Rajkot, Gujarat', 'price': 6200, 'change': -1.2},
        {'crop': 'Mustard', 'mandi': 'Jaipur, RJ', 'price': 5100, 'change': 2.8},
        {'crop': 'Onion', 'mandi': 'Lasalgaon, MH', 'price': 1850, 'change': 5.2},
        {'crop': 'Chilli', 'mandi': 'Guntur, AP', 'price': 15600, 'change': -1.4},
        {'crop': 'Turmeric', 'mandi': 'Nizamabad, TS', 'price': 8900, 'change': 2.1},
        {'crop': 'Garlic', 'mandi': 'Mandsaur, MP', 'price': 12400, 'change': 4.5},
        {'crop': 'Potato', 'mandi': 'Agra, UP', 'price': 1250, 'change': -0.5},
        {'crop': 'Tomato', 'mandi': 'Kolar, Karnataka', 'price': 2700, 'change': 6.3}
    ]
    db.markets.insert_many(markets_data)

    print("Seeding Buyers...")
    buyers_data = [
        {'name': 'ITC Agri Business', 'type': 'Corporate Buyer', 'crop': 'Wheat, Rice', 'location': 'Kolkata, WB', 'rating': 4.8, 'icon': 'ph-buildings'},
        {'name': 'Reliance Fresh', 'type': 'Retail Chain', 'crop': 'Vegetables, Fruits', 'location': 'Mumbai, MH', 'rating': 4.7, 'icon': 'ph-storefront'},
        {'name': 'Cargill India', 'type': 'Export House', 'crop': 'Soybean, Corn', 'location': 'Gurgaon, HR', 'rating': 4.9, 'icon': 'ph-globe-hemisphere-west'}
    ]
    db.buyers.insert_many(buyers_data)
    
    print("Seeding Negotiations...")
    neg_data = [
        {'id': 1, 'buyer': 'ITC Agri Business', 'crop': 'Wheat', 'buyerPrice': 2750, 'marketPrice': 2840, 'status': 'open'}
    ]
    db.negotiations.insert_many(neg_data)

    print("🎉 All seeds migrated to MongoDB successfully!")

except Exception as e:
    print(f"❌ Connection or Seeding Failed: {e}")
