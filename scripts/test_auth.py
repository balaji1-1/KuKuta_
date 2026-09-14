import json
from django.conf import settings
from django.test import Client

settings.ALLOWED_HOSTS.append('testserver')

c = Client()

def jpost(path, payload):
    r = c.post(path, json.dumps(payload), content_type='application/json')
    print(path, r.status_code)
    try:
        print(r.json())
    except Exception:
        print('non-json response:', r.content.decode())

print('\n-- auth integration tests --')
jpost('/api/login/', {'username': 'demo', 'password': 'DemoPass123!'})
jpost('/api/signup/', {'username': 'integuser3', 'email': 'integ3@example.com', 'password': 'IntegPass123!', 'name': 'Integration User'})
jpost('/api/login/', {'username': 'integuser3', 'password': 'IntegPass123!'})
jpost('/api/signup/', {'username': 'demo', 'email': 'demo@example.com', 'password': 'x'})
print('-- done --')
