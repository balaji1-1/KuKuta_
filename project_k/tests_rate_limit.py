from django.core.cache import cache
from django.test import RequestFactory, SimpleTestCase, override_settings
from django.http import HttpResponse

from Kukuta.security_middleware import RateLimitMiddleware


class RateLimitMiddlewareTests(SimpleTestCase):
    def setUp(self):
        cache.clear()
        self.request_factory = RequestFactory()
        self.middleware = RateLimitMiddleware(lambda request: HttpResponse())

    def make_request(self, path, remote_addr="203.0.113.10"):
        return self.request_factory.get(path, HTTP_X_FORWARDED_FOR=remote_addr)

    @override_settings(API_REQUEST_MINUTE_LIMIT=3, DEBUG=False)
    def test_global_limit_rejects_requests_after_budget_is_exhausted(self):
        for _ in range(3):
            response = self.middleware.process_request(self.make_request("/api/products/"))
            self.assertIsNone(response)

        response = self.middleware.process_request(self.make_request("/api/products/"))

        self.assertEqual(response.status_code, 429)
        self.assertIn("request limit", response.content.decode().lower())

    @override_settings(API_REQUEST_MINUTE_LIMIT=100, DEBUG=False)
    def test_endpoint_specific_limit_remains_active(self):
        request = self.make_request("/api/products/")
        request.method = "POST"

        for _ in range(60):
            response = self.middleware.process_request(request)
            self.assertIsNone(response)

        response = self.middleware.process_request(request)

        self.assertEqual(response.status_code, 429)
