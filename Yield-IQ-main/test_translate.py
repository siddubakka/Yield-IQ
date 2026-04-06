import requests

mirrors = [
    "https://libretranslate.pussthecat.org/translate",
    "https://translate.astian.org/translate",
    "https://translate.mentality.rip/translate",
    "https://trans.zillyhuhn.com/translate"
]

for url in mirrors:
    try:
        res = requests.post(url, json={'q': ['Hello', 'World'], 'source': 'en', 'target': 'hi', 'format': 'text'}, timeout=5)
        print(url, res.status_code, res.text[:200])
    except Exception as e:
        print(url, "Error:", str(e)[:100])
