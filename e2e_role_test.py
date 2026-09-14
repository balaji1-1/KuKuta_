import json
import urllib.request
import urllib.error
import time

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
            return e.code, {'error': 'HTTPError', 'content': str(e)}
    except Exception as e:
        return None, {'error': str(e)}

print('Waiting a moment for servers to be ready...')
for i in range(5):
    time.sleep(1)
print('Creating user...')
code, data = post('/api/signup/', {'username':'e2euser','email':'e2euser@example.com','password':'s3cr3tPW','name':'E2E User'})
print('signup', code, data)

print('Logging in...')
code, data = post('/api/login/', {'username':'e2euser','password':'s3cr3tPW'})
print('login', code, data)
if not data or 'tokens' not in data:
    print('Login failed; stop')
    raise SystemExit(1)
access = data['tokens']['access']

print('Toggling role to seller...')
code, data = post('/api/role-toggle/', {'role':'seller', 'username':'e2euser'}, token=access)
print('role-toggle', code, data)

print('Done')
