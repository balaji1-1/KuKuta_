try:
    import importlib
    TestCase = importlib.import_module('django.test').TestCase
    APIClient = importlib.import_module('rest_framework.test').APIClient
    User = importlib.import_module('django.contrib.auth.models').User
    UserProfile = importlib.import_module('project_k.models').UserProfile
    settings = importlib.import_module('django.conf').settings
    patch = importlib.import_module('unittest.mock').patch
except Exception:
    # Fallbacks for editor/static-analysis environments where Django/DRF
    # aren't available. These are simple stubs and used only when imports fail.
    from unittest import TestCase

    class settings:
        CSRF_COOKIE_HTTPONLY = True

    class APIClient:
        def post(self, *args, **kwargs):
            class _Resp:
                status_code = 500

                def json(self):
                    return {}

            return _Resp()

    class User:
        class objects:
            @staticmethod
            def create_user(*a, **k):
                return None

    class UserProfile:
        pass


class AuthSettingsTests(TestCase):
    def test_csrf_cookie_is_readable_by_browser_js(self):
        self.assertFalse(settings.CSRF_COOKIE_HTTPONLY)


class AuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_signup_returns_tokens(self):
        resp = self.client.post('/api/signup/', {
            'username': 'testuser',
            'email': 'testuser@example.com',
            'password': 's3cr3tPW',
            'name': 'Test User'
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertIn('tokens', data)
        self.assertIn('access', data['tokens'])
        self.assertIn('refresh', data['tokens'])

    def test_login_returns_tokens(self):
        User.objects.create_user(username='loginuser', email='login@example.com', password='pw1234')
        resp = self.client.post('/api/login/', {
            'username': 'loginuser',
            'password': 'pw1234'
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('tokens', data)
        self.assertIn('access', data['tokens'])
        self.assertIn('refresh', data['tokens'])

    def test_password_reset_endpoint_returns_reset_link(self):
        user = User.objects.create_user(username='resetuser', email='resetuser@example.com', password='pw1234')
        resp = self.client.post('/api/password-reset/', {
            'email': user.email,
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('message', data)
        self.assertIn('reset_link', data)
        self.assertIn('uid', data)
        self.assertIn('token', data)

    @patch('project_k.views.send_mail')
    def test_password_reset_email_uses_registered_email(self, send_mail):
        user = User.objects.create_user(username='emailreset', email='emailreset@example.com', password='pw1234')
        resp = self.client.post('/api/password-reset/', {
            'identifier': user.email,
        }, format='json')

        self.assertEqual(resp.status_code, 200)
        send_mail.assert_called_once()
        self.assertEqual(send_mail.call_args.args[3], [user.email])

    @patch('project_k.views.send_sms_otp')
    def test_password_reset_phone_uses_registered_phone(self, send_sms):
        user = User.objects.create_user(username='phonereset', email='phonereset@example.com', password='pw1234')
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.phone = '08012345678'
        profile.save()
        resp = self.client.post('/api/password-reset/', {
            'identifier': profile.phone,
        }, format='json')

        self.assertEqual(resp.status_code, 200)
        send_sms.assert_called_once()
        self.assertEqual(send_sms.call_args.args[0], profile.phone)

    @patch('project_k.views.send_sms_otp')
    def test_complete_password_reset_flow_for_registered_test_phone(self, send_sms):
        user = User.objects.create_user(username='phoneflow', email='phoneflow@example.com', password='old-password')
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.phone = '8106565391'
        profile.save()

        request_response = self.client.post('/api/password-reset/', {
            'identifier': '8106565391',
        }, format='json')

        self.assertEqual(request_response.status_code, 200)
        send_sms.assert_called_once()
        self.assertEqual(send_sms.call_args.args[0], '8106565391')
        otp = send_sms.call_args.args[1]
        reset_data = request_response.json()

        confirm_response = self.client.post(
            f"/api/password-reset-confirm/{reset_data['uid']}/{reset_data['token']}/",
            {
                'identifier': '8106565391',
                'otp': otp,
                'new_password': 'new-password-123',
            },
            format='json',
        )

        self.assertEqual(confirm_response.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.check_password('new-password-123'))

    def test_user_can_change_their_own_role_to_seller(self):
        user = User.objects.create_user(username='selfrole', email='selfrole@example.com', password='pw1234')
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = 'buyer'
        profile.save()

        self.client.force_authenticate(user=user)
        resp = self.client.post('/api/role-toggle/', {
            'username': user.username,
            'role': 'seller',
        }, format='json')

        self.assertEqual(resp.status_code, 200)
        profile.refresh_from_db()
        self.assertEqual(profile.role, 'seller')
        data = resp.json()
        self.assertEqual(data['role'], 'seller')
