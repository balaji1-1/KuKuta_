import json, urllib.request, urllib.error

BASE='http://127.0.0.1:8000'

def post(path, data, token=None):
    url = BASE + path
    b = json.dumps(data).encode('utf-8')
    headers = {'Content-Type':'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(url, data=b, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.getcode(), json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode('utf-8')
            return e.code, json.loads(body)
        except Exception:
            return e.code, {'error': str(e)}
    except Exception as e:
        return None, {'error': str(e)}

# Login
code, data = post('/api/login/', {'username':'e2euser','password':'s3cr3tPW'})
print('login', code, data)
if code != 200:
    raise SystemExit('login failed')
access = data['tokens']['access']

# Try role-toggle with only role
code, data = post('/api/role-toggle/', {'role':'seller'}, token=access)
print('role-toggle (no username)', code, data)

# Try role-toggle with username included
code2, data2 = post('/api/role-toggle/', {'role':'seller', 'username':'e2euser'}, token=access)
print('role-toggle (with username)', code2, data2)

# Show active user via a profile endpoint if exists
try:
    req = urllib.request.Request(BASE + '/api/me/', headers={'Authorization':'Bearer '+access})
    with urllib.request.urlopen(req, timeout=10) as resp:
        print('me', resp.status, resp.read().decode('utf-8'))
except Exception as e:
    print('me error', e)
