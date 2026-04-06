import requests
url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&q=hello&q=world"
res = requests.get(url)
print(res.json())
