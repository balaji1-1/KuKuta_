import http.client
conn = http.client.HTTPConnection('127.0.0.1',8000)
conn.request('OPTIONS','/api/login/',headers={'Origin':'http://127.0.0.1:5184','Access-Control-Request-Method':'POST'})
res=conn.getresponse()
print(res.status, res.reason)
for k,v in res.getheaders():
    print(k+':',v)
print(res.read())
