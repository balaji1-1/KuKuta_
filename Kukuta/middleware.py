from django.conf import settings
from django.utils.deprecation import MiddlewareMixin


class SecurityHeadersMiddleware(MiddlewareMixin):
    def process_response(self, request, response):
        response.setdefault('X-Content-Type-Options', 'nosniff')
        response.setdefault('X-Frame-Options', 'DENY')
        response.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
        response.setdefault('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
        response.setdefault('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
        
        # Build CSP header - simpler version
        if settings.DEBUG:
            # Development: Allow Vite dev server on port 5179
            csp_header = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' http://127.0.0.1:5179 http://localhost:5179; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com http://127.0.0.1:5179 http://localhost:5179; "
                "img-src 'self' data: https://images.unsplash.com https://picsum.photos https://i.imgur.com http://127.0.0.1:5179 http://localhost:5179 http://127.0.0.1:8000 http://localhost:8000; "
                "font-src 'self' https://fonts.gstatic.com; "
                "connect-src 'self' http://127.0.0.1:5179 http://localhost:5179 ws://127.0.0.1:5179 ws://localhost:5179 http://127.0.0.1:8000 http://localhost:8000; "
                "frame-ancestors 'none'; "
                "base-uri 'self';"
            )
        else:
            # Production: Strict CSP
            csp_header = (
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https://images.unsplash.com https://picsum.photos https://i.imgur.com; font-src 'self'; connect-src 'self'; "
                "frame-ancestors 'none'; base-uri 'self';"
            )
        
        response.setdefault('Content-Security-Policy', csp_header)
        # In development allow cross-origin requests from local dev servers
        if settings.DEBUG:
            origin = request.META.get('HTTP_ORIGIN') or '*'
            response.setdefault('Access-Control-Allow-Origin', origin)
            response.setdefault('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE')
            response.setdefault('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            response.setdefault('Access-Control-Allow-Credentials', 'true')
            # Relax resource policy for development so media served from the Django
            # media host (different port) can be used by the Vite frontend without
            # being blocked by cross-origin resource restrictions.
            response['Cross-Origin-Resource-Policy'] = 'cross-origin'
            # Make opener policy less strict in dev to avoid opaque-response blocking
            response['Cross-Origin-Opener-Policy'] = 'same-origin-allow-popups'
        return response
