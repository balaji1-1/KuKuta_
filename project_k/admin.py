from django.contrib import admin  # type: ignore[import]
from .models import Product, UserProfile, UserCredential

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'price', 'category', 'bird_type', 'seller')
    list_filter = ('category', 'bird_type')
    search_fields = ('name', 'seller', 'category', 'bird_type')

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'is_verified', 'created_at')
    list_filter = ('role', 'is_verified', 'created_at')
    search_fields = ('user__username', 'user__email', 'city')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('User Info', {'fields': ('user', 'role', 'is_verified')}),
        ('Contact', {'fields': ('phone', 'address', 'city', 'state', 'postal_code', 'country')}),
        ('Profile', {'fields': ('profile_image',)}),
        ('Dates', {'fields': ('created_at', 'updated_at')}),
    )

@admin.register(UserCredential)
class UserCredentialAdmin(admin.ModelAdmin):
    list_display = ('user', 'last_login_time', 'login_attempts', 'is_active_session')
    list_filter = ('is_active_session', 'last_login_time')
    search_fields = ('user__username', 'last_login_ip')
    readonly_fields = ('created_at', 'updated_at', 'last_login_time', 'last_login_ip')
