import requests
try:
    res = requests.post('http://127.0.0.1:5000/api/translate', json={'q': ['Dashboard', 'Market'], 'target': 'hi'})
    print("STATUS", res.status_code)
    print("DATA", res.json())
except Exception as e:
    print("ERROR", e)
