import json, time
from django.conf import settings
from django.test import Client

settings.ALLOWED_HOSTS.append('testserver')

c = Client()

uname = f"integ_{int(time.time())}"
print('using username', uname)

def jpost(path, payload):
    r = c.post(path, json.dumps(payload), content_type='application/json')
    print(path, r.status_code)
    try:
        print(r.json())
    except Exception:
        print('non-json response:', r.content.decode())

jpost('/api/signup/', {'username': uname, 'email': f'{uname}@example.com', 'password': 'IntegPass123!', 'name': 'Integration User'})
jpost('/api/login/', {'username': uname, 'password': 'IntegPass123!'})

# Cleanup: not removing user because not necessary
print('-- done --')
