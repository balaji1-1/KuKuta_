import json, urllib.request, urllib.error

def post(path,data):
    url='http://127.0.0.1:8000'+path
    b=json.dumps(data).encode('utf-8')
    req=urllib.request.Request(url,data=b,headers={'Content-Type':'application/json'},method='POST')
    with urllib.request.urlopen(req,timeout=10) as r:
        print(r.read().decode('utf-8'))

if __name__=='__main__':
    import urllib.request, json
    req = urllib.request.Request('http://127.0.0.1:8000/api/login/', data=json.dumps({'username':'e2euser','password':'s3cr3tPW'}).encode('utf-8'), headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req, timeout=10) as r:
        data = json.loads(r.read().decode('utf-8'))
        print(data['tokens']['access'])
