import requests, urllib.parse
texts = ["Dashboard", "Markets", "Crop Health", "Search city..."]
joined_text = "\n".join(texts)
gtx_url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&q={urllib.parse.quote(joined_text)}"
res = requests.get(gtx_url)
t_text = "".join([s[0] for s in res.json()[0] if s[0]])
splitted = [t.strip() for t in t_text.split('\n')]
print(splitted)
