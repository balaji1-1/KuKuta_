import json
import uuid
import urllib.request
import urllib.error
import http.cookiejar
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Kukuta.settings')
import django
django.setup()

from django.contrib.auth.models import User
from project_k.models import UserProfile

base = 'http://127.0.0.1:8000'
jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

def request(path, payload=None, method='POST'):
    headers = {'Accept': 'application/json'}
    data = None
    if payload is not None:
        data = json.dumps(payload).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(base + path, data=data, headers=headers, method=method)
    try:
        with opener.open(req, timeout=20) as r:
            body = r.read().decode('utf-8', 'replace')
            parsed = json.loads(body) if body else {}
            print(f'[{method}] {path} -> {r.status}')
            print(json.dumps(parsed, indent=2, ensure_ascii=False)[:800])
            return r.status, parsed
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', 'replace')
        parsed = json.loads(body) if body else {}
        print(f'[{method}] {path} -> {e.code}')
        print(json.dumps(parsed, indent=2, ensure_ascii=False)[:800])
        return e.code, parsed

unique = uuid.uuid4().hex[:8]
email = f'flow{unique}@example.com'
username = f'flowuser{unique}'
password = 'StrongPass123!'

status, resp = request('/api/signup/', {
    'username': username,
    'email': email,
    'password': password,
    'name': 'Flow Tester'
}, 'POST')
if status != 201:
    raise SystemExit(f'SIGNUP_FAILED: {resp}')

user = User.objects.get(email=email)
profile, _ = UserProfile.objects.get_or_create(user=user)
phone = f'080{uuid.uuid4().hex[:8]}'
profile.phone = phone
profile.save()
print(f'Assigned mobile for {email}: {phone}')

status, resp = request('/api/login/', {'identifier': email, 'password': password}, 'POST')
if status != 200:
    raise SystemExit(f'EMAIL_LOGIN_FAILED: {resp}')
if 'tokens' not in resp or 'access' not in resp['tokens']:
    raise SystemExit(f'EMAIL_LOGIN_NO_TOKENS: {resp}')

status, resp = request('/api/login/', {'identifier': phone, 'password': password}, 'POST')
if status != 200:
    raise SystemExit(f'MOBILE_LOGIN_FAILED: {resp}')
if 'tokens' not in resp or 'access' not in resp['tokens']:
    raise SystemExit(f'MOBILE_LOGIN_NO_TOKENS: {resp}')

status, resp = request('/api/password-reset/', {'identifier': email}, 'POST')
if status != 200:
    raise SystemExit(f'EMAIL_RESET_START_FAILED: {resp}')
uid = resp.get('uid')
token = resp.get('token')
profile.refresh_from_db()
email_otp = profile.password_reset_otp
if not email_otp:
    raise SystemExit('EMAIL_OTP_MISSING')

status, resp = request(f'/api/password-reset-confirm/{uid}/{token}/', {
    'identifier': email,
    'otp': email_otp,
    'new_password': 'ResetByEmail456!'
}, 'POST')
if status != 200:
    raise SystemExit(f'EMAIL_RESET_CONFIRM_FAILED: {resp}')
if resp.get('message') != 'Password reset successful':
    raise SystemExit(f'EMAIL_RESET_MESSAGE_UNEXPECTED: {resp}')

status, resp = request('/api/login/', {'identifier': email, 'password': 'ResetByEmail456!'}, 'POST')
if status != 200:
    raise SystemExit(f'EMAIL_LOGIN_AFTER_RESET_FAILED: {resp}')

new_phone = f'081{uuid.uuid4().hex[:8]}'
profile.phone = new_phone
profile.save()

status, resp = request('/api/password-reset/', {'identifier': new_phone}, 'POST')
if status != 200:
    raise SystemExit(f'MOBILE_RESET_START_FAILED: {resp}')
uid2 = resp.get('uid')
token2 = resp.get('token')
profile.refresh_from_db()
phone_otp = profile.password_reset_otp
if not phone_otp:
    raise SystemExit('MOBILE_OTP_MISSING')

status, resp = request(f'/api/password-reset-confirm/{uid2}/{token2}/', {
    'identifier': new_phone,
    'otp': phone_otp,
    'new_password': 'ResetByMobile789!'
}, 'POST')
if status != 200:
    raise SystemExit(f'MOBILE_RESET_CONFIRM_FAILED: {resp}')
if resp.get('message') != 'Password reset successful':
    raise SystemExit(f'MOBILE_RESET_MESSAGE_UNEXPECTED: {resp}')

status, resp = request('/api/login/', {'identifier': new_phone, 'password': 'ResetByMobile789!'}, 'POST')
if status != 200:
    raise SystemExit(f'MOBILE_LOGIN_AFTER_RESET_FAILED: {resp}')

print('\nALL AUTH FLOWS VERIFIED SUCCESSFULLY')
