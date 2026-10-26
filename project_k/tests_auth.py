try:
    import importlib
    TestCase = importlib.import_module('django.test').TestCase
    APIClient = importlib.import_module('rest_framework.test').APIClient
    User = importlib.import_module('django.contrib.auth.models').User
    models_mod = importlib.import_module('project_k.models')
    UserProfile = models_mod.UserProfile
    Product = models_mod.Product
    timezone = importlib.import_module('django.utils.timezone')
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


class OrderTrackingTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='buyer1', email='buyer1@example.com', password='pw1234')
        profile, _ = UserProfile.objects.get_or_create(user=self.user)
        profile.role = 'buyer'
        profile.save()
        self.seller = User.objects.create_user(username='seller1', email='seller1@example.com', password='pw1234')
        seller_profile, _ = UserProfile.objects.get_or_create(user=self.seller)
        seller_profile.role = 'seller'
        seller_profile.save()
        self.product = Product.objects.create(
            name='Layer Hen',
            price='₹1500',
            quantity=5,
            description='Healthy layer hen',
            category='Bird',
            bird_type='Pullet',
            seller=self.seller.username,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_order_is_visible_only_after_both_accept_the_same_price(self):
        buyer_response = self.client.post('/api/orders/price-agreement/', {
            'product_id': self.product.id,
            'participant': self.seller.username,
            'agreed_price': '1350.00',
        }, format='json')

        self.assertEqual(buyer_response.status_code, 200)
        pending = buyer_response.json()
        self.assertEqual(pending['status'], 'pending_price')
        self.assertTrue(pending['buyer_price_accepted'])
        self.assertFalse(pending['seller_price_accepted'])
        self.assertEqual(self.client.get('/api/orders/').json()['results'], [])
        loaded = self.client.get(
            f'/api/orders/price-agreement/?product_id={self.product.id}&participant={self.seller.username}'
        ).json()
        self.assertEqual(loaded['id'], pending['id'])
        self.assertTrue(loaded['buyer_price_accepted'])

        seller_client = APIClient()
        seller_client.force_authenticate(user=self.seller)
        seller_response = seller_client.post('/api/orders/price-agreement/', {
            'product_id': self.product.id,
            'participant': self.user.username,
            'agreed_price': '1350.00',
        }, format='json')

        self.assertEqual(seller_response.status_code, 200, seller_response.json())
        confirmed = seller_response.json()
        self.assertEqual(confirmed['status'], 'confirmed')
        self.assertEqual(confirmed['agreed_price'], '1350.00')
        self.assertTrue(confirmed['buyer_price_accepted'])
        self.assertTrue(confirmed['seller_price_accepted'])
        self.assertTrue(any(
            order['id'] == confirmed['id']
            for order in self.client.get('/api/orders/').json()['results']
        ))

    def test_accepting_a_different_price_resets_the_other_acceptance(self):
        pending = self.client.post('/api/orders/price-agreement/', {
            'product_id': self.product.id,
            'participant': self.seller.username,
            'agreed_price': '1350.00',
        }, format='json').json()

        seller_client = APIClient()
        seller_client.force_authenticate(user=self.seller)
        updated = seller_client.post('/api/orders/price-agreement/', {
            'product_id': self.product.id,
            'participant': self.user.username,
            'agreed_price': '1400.00',
            'order_id': pending['id'],
        }, format='json').json()

        self.assertEqual(updated['status'], 'pending_price')
        self.assertEqual(updated['agreed_price'], '1400.00')
        self.assertFalse(updated['buyer_price_accepted'])
        self.assertTrue(updated['seller_price_accepted'])

    def test_same_role_participants_can_confirm_price_agreements(self):
        for role in ('buyer', 'seller'):
            with self.subTest(role=role):
                UserProfile.objects.filter(user=self.user).update(role=role)
                UserProfile.objects.filter(user=self.seller).update(role=role)
                first_client = APIClient()
                first_client.force_authenticate(user=self.user)
                second_client = APIClient()
                second_client.force_authenticate(user=self.seller)

                first_response = first_client.post('/api/orders/price-agreement/', {
                    'product_id': self.product.id,
                    'participant': self.seller.username,
                    'agreed_price': '1250.00',
                }, format='json')
                self.assertEqual(first_response.status_code, 200, first_response.json())
                self.assertEqual(first_response.json()['status'], 'pending_price')

                second_response = second_client.post('/api/orders/price-agreement/', {
                    'product_id': self.product.id,
                    'participant': self.user.username,
                    'agreed_price': '1250.00',
                }, format='json')
                self.assertEqual(second_response.status_code, 200, second_response.json())
                self.assertEqual(second_response.json()['status'], 'confirmed')
                self.assertTrue(any(
                    order['id'] == second_response.json()['id']
                    for order in first_client.get('/api/orders/').json()['results']
                ))
                self.assertTrue(any(
                    order['id'] == second_response.json()['id']
                    for order in second_client.get('/api/orders/').json()['results']
                ))

    def test_direct_order_creation_is_blocked(self):
        response = self.client.post('/api/orders/', {
            'product': self.product.id,
            'seller': self.seller.username,
        }, format='json')
        self.assertEqual(response.status_code, 409)


class AuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_signup_returns_tokens(self):
        resp = self.client.post('/api/signup/', {
            'username': 'testuser',
            'email': 'testuser@example.com',
            'password': 's3cr3tPassw0rd',
            'name': 'Test User'
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertIn('tokens', data)
        self.assertIn('access', data['tokens'])
        self.assertIn('refresh', data['tokens'])

    def test_login_returns_tokens(self):
        User.objects.create_user(username='loginuser', email='login@example.com', password='pw12345678')
        resp = self.client.post('/api/login/', {
            'username': 'loginuser',
            'password': 'pw12345678'
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('tokens', data)
        self.assertIn('access', data['tokens'])
        self.assertIn('refresh', data['tokens'])

    def test_password_reset_endpoint_returns_reset_link(self):
        user = User.objects.create_user(username='resetuser', email='resetuser@example.com', password='pw12345678')
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
    def test_password_reset_otp_expires_after_five_minutes(self, send_mail):
        user = User.objects.create_user(username='five-minute-reset', email='five-minute-reset@example.com', password='pw12345678')
        resp = self.client.post('/api/password-reset/', {
            'identifier': user.email,
        }, format='json')

        self.assertEqual(resp.status_code, 200)
        profile = UserProfile.objects.get(user=user)
        seconds_until_expiry = (profile.password_reset_otp_expires_at - timezone.now()).total_seconds()
        self.assertGreater(seconds_until_expiry, 295)
        self.assertLessEqual(seconds_until_expiry, 300)
        self.assertEqual(resp.json()['expires_at'], profile.password_reset_otp_expires_at.isoformat())
        self.assertIn('expires_at=', resp.json()['reset_link'])

    def test_password_reset_uses_frontend_url_when_vite_dev_server_is_running(self):
        user = User.objects.create_user(username='vitefront', email='vitefront@example.com', password='pw12345678')
        with self.settings(DEBUG=True, VITE_DEV_SERVER_URL='http://127.0.0.1:5180/static/'):
            resp = self.client.post('/api/password-reset/', {
                'identifier': user.email,
            }, format='json')

        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data['reset_link'].startswith('http://127.0.0.1:5180/password-reset-confirm/'))
        self.assertNotIn('http://127.0.0.1:8000', data['reset_link'])

    def test_password_reset_uses_request_origin_when_production_frontend_url_is_unset(self):
        user = User.objects.create_user(username='originreset', email='originreset@example.com', password='pw12345678')
        with self.settings(
            DEBUG=False,
            FRONTEND_URL=None,
            VITE_DEV_SERVER_URL=None,
            ALLOWED_HOSTS=['kukuta.example.com'],
        ):
            resp = self.client.post(
                '/api/password-reset/',
                {'identifier': user.email},
                format='json',
                HTTP_HOST='kukuta.example.com',
                secure=True,
            )

        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data['reset_link'].startswith('https://kukuta.example.com/password-reset-confirm/'))

    @patch('project_k.views.send_mail')
    def test_password_reset_email_uses_registered_email(self, send_mail):
        user = User.objects.create_user(username='emailreset', email='emailreset@example.com', password='pw12345678')
        resp = self.client.post('/api/password-reset/', {
            'identifier': user.email,
        }, format='json')

        self.assertEqual(resp.status_code, 200)
        send_mail.assert_called_once()
        self.assertEqual(send_mail.call_args.args[3], [user.email])
        self.assertIn('html_message', send_mail.call_args.kwargs)
        self.assertIn('5 minutes', send_mail.call_args.kwargs['html_message'])
        self.assertIn('password-reset-confirm/', send_mail.call_args.kwargs['html_message'])

    @patch('project_k.views.send_sms_otp')
    def test_password_reset_phone_uses_registered_phone(self, send_sms):
        user = User.objects.create_user(username='phonereset', email='phonereset@example.com', password='pw12345678')
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
        user = User.objects.create_user(username='phoneflow', email='phoneflow@example.com', password='old-password-12')
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
                'new_password': 'new-password-1234',
            },
            format='json',
        )

        self.assertEqual(confirm_response.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.check_password('new-password-1234'))

    def test_user_can_change_their_own_role_to_seller(self):
        user = User.objects.create_user(username='selfrole', email='selfrole@example.com', password='pw12345678')
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
