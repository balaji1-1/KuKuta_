import urllib.request
url = 'http://127.0.0.1:5186/static/'
try:
    req = urllib.request.Request(url, method='GET')
    with urllib.request.urlopen(req, timeout=5) as resp:
        print('STATUS', resp.status)
        for k, v in resp.getheaders():
            print(k+':', v)
except Exception as e:
    print('ERROR', e)
