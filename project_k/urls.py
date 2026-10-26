try:
    from django.urls import path  # type: ignore
except Exception:
    # Fallback to provide a clearer error when Django isn't available in the environment
    def path(route, view, name=None):
        raise ImportError('Django is not installed; install Django to use URL configuration.')
try:
    from rest_framework.routers import DefaultRouter
except Exception:
    class DefaultRouter:
        def __init__(self, *args, **kwargs):
            raise ImportError('Django REST framework is not installed; install djangorestframework to use API routing.')

from . import views

try:
    from importlib import import_module
    jwt_views = import_module('rest_framework_simplejwt.views')
    TokenObtainPairView = getattr(jwt_views, 'TokenObtainPairView', None)
    TokenRefreshView = getattr(jwt_views, 'TokenRefreshView', None)
except ImportError:
    TokenObtainPairView = None
    TokenRefreshView = None

router = DefaultRouter()
router.register(r'products', views.ProductViewSet)
router.register(r'messages', views.MessageViewSet)
router.register(r'orders', views.OrderViewSet)
router.register(r'reviews', views.ProductReviewViewSet)

urlpatterns = router.urls + [
    path('csrf/', views.csrf_token_view, name='csrf_token'),
    path('me/', views.current_user_view, name='current_user'),
    path('login/', views.login_view, name='login'),
    path('signup/', views.signup_view, name='signup'),
    path('role-toggle/', views.role_toggle_view, name='role_toggle'),
    path('password-reset/', views.password_reset_view, name='password_reset'),
    path('password-reset-confirm/<uidb64>/<token>/', views.password_reset_confirm_view, name='password_reset_confirm'),
]

if TokenObtainPairView is not None and TokenRefreshView is not None:
    urlpatterns += [
        path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
        path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    ]

1