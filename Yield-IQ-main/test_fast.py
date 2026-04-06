import requests
res = requests.post('http://127.0.0.1:5000/api/translate', json={'q': ['test'] * 20, 'target': 'hi'})
print("Code", res.status_code)
print("Data", res.json())
