import requests

query = "Pehle Bhi Main Vishal Mishra, Raj Shekhar"
print("Testing search for:", query)
try:
    res = requests.get(f"https://testyt1.netlify.app/api/search?q={query}")
    print(res.status_code)
    print(res.text[:500])
except Exception as e:
    print(e)
