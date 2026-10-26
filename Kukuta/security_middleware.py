"""
Enhanced security middleware for Kukuta project.
Provides additional security headers, rate limiting, and logging.
"""

import logging
import hashlib
from django.utils.deprecation import MiddlewareMixin
from django.http import JsonResponse
from django.core.cache import cache
from django.conf import settings

logger = logging.getLogger(__name__)


class RateLimitMiddleware(MiddlewareMixin):
    """Apply shared and endpoint-specific request limits before a view runs."""

    LIMITS = {
        '/api/auth/login': 5,
        '/api/auth/signup': 3,
        '/api/auth/password-reset': 3,
        '/api/auth/password-reset-confirm': 20,
        '/api/products': 60,
        '/api/reviews': 20,
        '/api/messages': 30,
    }
    DEFAULT_LIMIT = 100

    def get_client_ip(self, request):
        """Extract the client IP without trusting an unvalidated proxy header."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR', '0.0.0.0')
        return ip

    def get_rate_limit(self, request):
        """Get the endpoint-specific limit, falling back to the global budget."""
        path = request.path
        for route, limit in self.LIMITS.items():
            if path.startswith(route):
                return limit
        return self.DEFAULT_LIMIT

    def _consume_api_request(self, global_key, endpoint_key, global_limit, endpoint_limit):
        """Atomically consume one request across shared and endpoint counters."""
        client = getattr(cache, 'client', None)
        redis_client = getattr(client, 'get_client', lambda: None)()
        if redis_client is not None:
            script = redis_client.register_script(
                """
                local global_current = tonumber(redis.call('GET', KEYS[1]) or '0')
                if global_current >= tonumber(ARGV[1]) then
                    return 0
                end
                if tonumber(ARGV[2]) > 0 then
                    local endpoint_current = tonumber(redis.call('GET', KEYS[2]) or '0')
                    if endpoint_current >= tonumber(ARGV[2]) then
                        return 0
                    end
                end
                redis.call('INCR', KEYS[1])
                if global_current == 0 then
                    redis.call('EXPIRE', KEYS[1], ARGV[3])
                end
                if tonumber(ARGV[2]) > 0 then
                    redis.call('INCR', KEYS[2])
                    local endpoint_current_after = tonumber(redis.call('GET', KEYS[2]))
                    if endpoint_current_after == 1 then
                        redis.call('EXPIRE', KEYS[2], ARGV[3])
                    end
                end
                return 1
                """
            )
            return script(
                keys=[global_key, endpoint_key],
                args=[global_limit, endpoint_limit, 60],
            )

        current = cache.get(global_key, 0)
        if current >= global_limit:
            return False
        if endpoint_limit > 0:
            endpoint_current = cache.get(endpoint_key, 0)
            if endpoint_current >= endpoint_limit:
                return False
        cache.set(global_key, current + 1, 60)
        if endpoint_limit > 0:
            endpoint_current = cache.get(endpoint_key, 0)
            cache.set(endpoint_key, endpoint_current + 1, 60)
        return True

    def process_request(self, request):
        """Reject traffic after the shared or endpoint limit is exhausted."""
        if settings.DEBUG or not request.path.startswith('/api/'):
            return None

        ip = self.get_client_ip(request)
        global_limit = int(getattr(settings, 'API_REQUEST_MINUTE_LIMIT', 1_000_000))
        global_count_key = 'api_requests_minute:global'
        endpoint_limit = self.get_rate_limit(request)
        endpoint_key = f'api_requests_minute:endpoint:{ip}:{request.path}'

        if not self._consume_api_request(
            global_count_key,
            endpoint_key,
            global_limit,
            endpoint_limit,
        ):
            if endpoint_limit < global_limit:
                logger.warning("Endpoint rate limit exceeded for IP %s on %s", ip, request.path)
                error_message = 'Rate limit exceeded. Please try again later.'
            else:
                logger.warning("Global API request limit exceeded from %s", ip)
                error_message = 'Global request limit exceeded. Please try again later.'
            return JsonResponse({'error': error_message}, status=429)

        return None


class SecurityHeadersMiddleware(MiddlewareMixin):
    """
    Additional security headers middleware.
    Complements Django's built-in security middleware.
    """
    
    def process_response(self, request, response):
        """Add security headers to response."""
        
        # Prevent MIME type sniffing
        response['X-Content-Type-Options'] = 'nosniff'
        
        # Enable XSS protection
        response['X-XSS-Protection'] = '1; mode=block'
        
        # Prevent clickjacking
        response['X-Frame-Options'] = 'DENY'
        
        # Control referrer information
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        # Feature policy / Permissions policy
        response['Permissions-Policy'] = (
            'geolocation=(), '
            'microphone=(), '
            'camera=(), '
            'usb=(), '
            'payment=()'
        )
        
        # Additional CSP headers (works with django-csp)
        # This is supplementary; main CSP is set in settings
        if not settings.DEBUG:
            response['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
        
        return response


class IPWhitelistMiddleware(MiddlewareMixin):
    """
    Optional IP whitelist middleware for admin/sensitive endpoints.
    Can be enabled via settings.
    """
    
    PROTECTED_PATHS = [
        '/admin/',
        '/api/admin/',
    ]
    
    def process_request(self, request):
        """Check if IP is whitelisted for protected paths."""
        if settings.DEBUG or not getattr(settings, 'USE_IP_WHITELIST', False):
            return None
        
        # Check if path is protected
        is_protected = any(
            request.path.startswith(path) for path in self.PROTECTED_PATHS
        )
        
        if not is_protected:
            return None
        
        # Get whitelisted IPs from settings
        whitelist = getattr(settings, 'IP_WHITELIST', [])
        
        if not whitelist:
            return None
        
        ip = self.get_client_ip(request)
        
        if ip not in whitelist:
            logger.warning(f"Blocked access attempt from non-whitelisted IP: {ip}")
            return JsonResponse(
                {'error': 'Access denied'},
                status=403
            )
        
        return None
    
    @staticmethod
    def get_client_ip(request):
        """Extract client IP from request."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR', '0.0.0.0')
        return ip


class RequestLoggingMiddleware(MiddlewareMixin):
    """
    Log all requests and responses for security monitoring.
    """
    
    # Paths to skip logging (avoid log spam)
    SKIP_LOGGING = [
        '/static/',
        '/media/',
        '/health/',
    ]
    
    def process_request(self, request):
        """Log incoming request."""
        if any(request.path.startswith(path) for path in self.SKIP_LOGGING):
            return None

        user = getattr(request, 'user', None)
        username = user.username if user is not None and getattr(user, 'is_authenticated', False) else 'anonymous'

        # Log request details
        logger.info(
            f"Request: {request.method} {request.path} "
            f"from {self.get_client_ip(request)} "
            f"User: {username}"
        )

        return None
    
    def process_response(self, request, response):
        """Log response status."""
        if any(request.path.startswith(path) for path in self.SKIP_LOGGING):
            return response
        
        # Log response status
        if response.status_code >= 400:
            logger.warning(
                f"Response: {response.status_code} for {request.method} {request.path}"
            )
        
        return response
    
    @staticmethod
    def get_client_ip(request):
        """Extract client IP from request."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR', '0.0.0.0')
        return ip
