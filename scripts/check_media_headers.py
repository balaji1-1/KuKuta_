import urllib.request
url = 'http://127.0.0.1:8000/media/products/images/WhatsApp_Image_2026-07-22_at_23.08.39.jpeg'
try:
    req = urllib.request.Request(url, method='GET')
    with urllib.request.urlopen(req, timeout=5) as resp:
        print('STATUS', resp.status)
        for k, v in resp.getheaders():
            print(k+':', v)
        data = resp.read(200)
        print('BODY_PREVIEW:', data[:200])
except Exception as e:
    print('ERROR', e)
