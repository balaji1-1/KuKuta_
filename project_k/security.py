"""
Security utilities for Kukuta project.
Provides input validation, sanitization, and security checks.
"""

import re
import bleach
from urllib.parse import urlparse
from django.core.exceptions import ValidationError
from django.utils.html import escape
from validator_collection import validators, checkers


# ============================================================================
# INPUT VALIDATION UTILITIES
# ============================================================================

class InputValidator:
    """Comprehensive input validation for user data."""
    
    # Allowed HTML tags for rich text (if needed)
    ALLOWED_TAGS = ['b', 'i', 'em', 'strong', 'p', 'br', 'a', 'ul', 'ol', 'li']
    ALLOWED_ATTRIBUTES = {'a': ['href', 'title']}
    
    @staticmethod
    def validate_username(username):
        """Validate username format and length."""
        if not username:
            raise ValidationError("Username cannot be empty")
        
        if len(username) < 3 or len(username) > 150:
            raise ValidationError("Username must be between 3 and 150 characters")
        
        # Only alphanumeric, dots, underscores, and hyphens
        if not re.match(r'^[a-zA-Z0-9._-]+$', username):
            raise ValidationError("Username can only contain letters, numbers, dots, underscores, and hyphens")
        
        # Cannot start or end with special characters
        if username[0] in '._-' or username[-1] in '._-':
            raise ValidationError("Username cannot start or end with special characters")
        
        return username
    
    @staticmethod
    def validate_email(email):
        """Validate email address format."""
        if not email:
            raise ValidationError("Email cannot be empty")
        
        email = email.strip().lower()
        
        if not checkers.is_email(email):
            raise ValidationError("Invalid email address format")
        
        if len(email) > 254:  # RFC 5321
            raise ValidationError("Email address is too long")
        
        return email
    
    @staticmethod
    def validate_password(password):
        """
        Validate password strength.
        Requirements:
        - At least 8 characters
        - At least one uppercase letter
        - At least one lowercase letter
        - At least one digit
        - At least one special character
        """
        if not password:
            raise ValidationError("Password cannot be empty")
        
        if len(password) < 8:
            raise ValidationError("Password must be at least 8 characters long")
        
        if not re.search(r'[A-Z]', password):
            raise ValidationError("Password must contain at least one uppercase letter")
        
        if not re.search(r'[a-z]', password):
            raise ValidationError("Password must contain at least one lowercase letter")
        
        if not re.search(r'\d', password):
            raise ValidationError("Password must contain at least one digit")
        
        if not re.search(r'[!@#$%^&*()_+\-=\[\]{};:\'",.<>?/\\|`~]', password):
            raise ValidationError("Password must contain at least one special character")
        
        return password
    
    @staticmethod
    def validate_phone(phone):
        """Validate phone number format."""
        if not phone:
            raise ValidationError("Phone number cannot be empty")
        
        # Remove common formatting characters
        cleaned = re.sub(r'[\s\-\(\)\+]', '', phone)
        
        # Must be digits only after cleaning
        if not cleaned.isdigit():
            raise ValidationError("Phone number must contain only digits and common formatting characters")
        
        # Check length (10-15 digits typically)
        if len(cleaned) < 10 or len(cleaned) > 15:
            raise ValidationError("Phone number must be between 10 and 15 digits")
        
        return phone
    
    @staticmethod
    def validate_product_name(name):
        """Validate product name."""
        if not name:
            raise ValidationError("Product name cannot be empty")
        
        name = name.strip()
        
        if len(name) < 3 or len(name) > 500:
            raise ValidationError("Product name must be between 3 and 500 characters")
        
        # Check for HTML/script injection attempts
        if re.search(r'<script|javascript:|onerror=|onclick=', name, re.IGNORECASE):
            raise ValidationError("Product name contains invalid content")
        
        return name
    
    @staticmethod
    def validate_product_description(description):
        """Validate product description."""
        if not description:
            raise ValidationError("Product description cannot be empty")
        
        description = description.strip()
        
        if len(description) < 10 or len(description) > 5000:
            raise ValidationError("Product description must be between 10 and 5000 characters")
        
        # Check for HTML/script injection
        if re.search(r'<script|javascript:|onerror=|onclick=', description, re.IGNORECASE):
            raise ValidationError("Product description contains invalid content")
        
        return description
    
    @staticmethod
    def validate_product_price(price):
        """Validate product price."""
        try:
            price_float = float(price)
        except (ValueError, TypeError):
            raise ValidationError("Price must be a valid number")
        
        if price_float < 0:
            raise ValidationError("Price cannot be negative")
        
        if price_float > 999999.99:
            raise ValidationError("Price is too high")
        
        return price_float
    
    @staticmethod
    def validate_product_quantity(quantity):
        """Validate product quantity."""
        try:
            qty_int = int(quantity)
        except (ValueError, TypeError):
            raise ValidationError("Quantity must be a whole number")
        
        if qty_int < 0:
            raise ValidationError("Quantity cannot be negative")
        
        if qty_int > 1000000:
            raise ValidationError("Quantity is too high")
        
        return qty_int
    
    @staticmethod
    def validate_review_text(text):
        """Validate review text."""
        if not text:
            raise ValidationError("Review text cannot be empty")
        
        text = text.strip()
        
        if len(text) < 5 or len(text) > 2000:
            raise ValidationError("Review must be between 5 and 2000 characters")
        
        # Check for HTML/script injection
        if re.search(r'<script|javascript:|onerror=|onclick=', text, re.IGNORECASE):
            raise ValidationError("Review contains invalid content")
        
        return text
    
    @staticmethod
    def validate_rating(rating):
        """Validate review rating."""
        try:
            rating_int = int(rating)
        except (ValueError, TypeError):
            raise ValidationError("Rating must be a whole number")
        
        if rating_int < 1 or rating_int > 5:
            raise ValidationError("Rating must be between 1 and 5")
        
        return rating_int
    
    @staticmethod
    def validate_url(url, allow_local=False):
        """Validate URL format and safety."""
        if not url:
            raise ValidationError("URL cannot be empty")
        
        url = url.strip()
        
        try:
            result = urlparse(url)
        except Exception:
            raise ValidationError("Invalid URL format")
        
        # Check scheme
        if result.scheme not in ('http', 'https'):
            raise ValidationError("URL must use http or https")
        
        # Check netloc (domain)
        if not result.netloc:
            raise ValidationError("URL must have a valid domain")
        
        # Prevent localhost/private IPs in production
        if not allow_local:
            private_patterns = [
                r'^localhost$',
                r'^127\.',
                r'^192\.168\.',
                r'^10\.',
                r'^172\.(1[6-9]|2[0-9]|3[01])\.',
            ]
            for pattern in private_patterns:
                if re.match(pattern, result.netloc):
                    raise ValidationError("URL cannot point to private/local addresses")
        
        return url


# ============================================================================
# INPUT SANITIZATION UTILITIES
# ============================================================================

class InputSanitizer:
    """Sanitize user input to prevent XSS and injection attacks."""
    
    @staticmethod
    def sanitize_text(text, strip_html=True):
        """
        Sanitize text input.
        
        Args:
            text: Text to sanitize
            strip_html: If True, remove all HTML tags. If False, allow safe tags.
        
        Returns:
            Sanitized text
        """
        if not isinstance(text, str):
            return str(text) if text else ""
        
        text = text.strip()
        
        if strip_html:
            # Remove all HTML tags
            text = bleach.clean(text, tags=[], strip=True)
        else:
            # Allow only safe tags
            text = bleach.clean(
                text,
                tags=InputValidator.ALLOWED_TAGS,
                attributes=InputValidator.ALLOWED_ATTRIBUTES,
                strip=True
            )
        
        return text
    
    @staticmethod
    def sanitize_html(html):
        """Sanitize HTML content, removing dangerous elements."""
        allowed_tags = ['b', 'i', 'em', 'strong', 'p', 'br', 'a', 'ul', 'ol', 'li', 'blockquote']
        allowed_attributes = {'a': ['href', 'title'], 'img': ['src', 'alt', 'width', 'height']}
        
        return bleach.clean(html, tags=allowed_tags, attributes=allowed_attributes, strip=True)
    
    @staticmethod
    def sanitize_filename(filename):
        """Sanitize filename to prevent directory traversal."""
        if not filename:
            return ""
        
        # Remove path components
        filename = filename.split('/')[-1].split('\\')[-1]
        
        # Remove special characters except dots, hyphens, underscores
        filename = re.sub(r'[^\w\-\.]', '_', filename)
        
        # Limit length
        name, ext = filename.rsplit('.', 1) if '.' in filename else (filename, '')
        name = name[:200]
        
        return f"{name}.{ext}" if ext else name


# ============================================================================
# FILE UPLOAD VALIDATION
# ============================================================================

class FileValidator:
    """Validate uploaded files for security and integrity."""
    
    ALLOWED_IMAGE_TYPES = {
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
    }
    
    ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
    
    ALLOWED_VIDEO_TYPES = {
        'video/mp4',
        'video/webm',
        'video/ogg',
    }
    
    ALLOWED_VIDEO_EXTENSIONS = {'.mp4', '.webm', '.ogg'}
    
    MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
    MAX_VIDEO_SIZE = 100 * 1024 * 1024  # 100MB
    MAX_IMAGE_DIMENSIONS = (4000, 4000)  # Max width x height
    
    @classmethod
    def validate_image(cls, uploaded_file):
        """Validate image file."""
        if not uploaded_file:
            raise ValidationError("No file provided")
        
        # Check file size
        if uploaded_file.size > cls.MAX_IMAGE_SIZE:
            raise ValidationError(f"Image file is too large (max {cls.MAX_IMAGE_SIZE / 1024 / 1024:.0f}MB)")
        
        # Check content type
        if uploaded_file.content_type not in cls.ALLOWED_IMAGE_TYPES:
            raise ValidationError(f"Invalid image type: {uploaded_file.content_type}")
        
        # Check file extension
        name_lower = uploaded_file.name.lower()
        if not any(name_lower.endswith(ext) for ext in cls.ALLOWED_IMAGE_EXTENSIONS):
            raise ValidationError(f"Invalid image extension: {uploaded_file.name}")
        
        # Validate image dimensions
        try:
            from PIL import Image
            img = Image.open(uploaded_file)
            if img.size[0] > cls.MAX_IMAGE_DIMENSIONS[0] or img.size[1] > cls.MAX_IMAGE_DIMENSIONS[1]:
                raise ValidationError(f"Image dimensions exceed maximum allowed")
        except Exception as e:
            if isinstance(e, ValidationError):
                raise
            raise ValidationError("Failed to validate image file")
        
        return True
    
    @classmethod
    def validate_video(cls, uploaded_file):
        """Validate video file."""
        if not uploaded_file:
            raise ValidationError("No file provided")
        
        # Check file size
        if uploaded_file.size > cls.MAX_VIDEO_SIZE:
            raise ValidationError(f"Video file is too large (max {cls.MAX_VIDEO_SIZE / 1024 / 1024:.0f}MB)")
        
        # Check content type
        if uploaded_file.content_type not in cls.ALLOWED_VIDEO_TYPES:
            raise ValidationError(f"Invalid video type: {uploaded_file.content_type}")
        
        # Check file extension
        name_lower = uploaded_file.name.lower()
        if not any(name_lower.endswith(ext) for ext in cls.ALLOWED_VIDEO_EXTENSIONS):
            raise ValidationError(f"Invalid video extension: {uploaded_file.name}")
        
        return True


# ============================================================================
# SECURITY CHECKS
# ============================================================================

class SecurityChecker:
    """Security checks for various operations."""
    
    @staticmethod
    def is_safe_redirect_url(url, allowed_hosts=None):
        """
        Check if redirect URL is safe.
        Prevents open redirect vulnerabilities.
        """
        if not url:
            return False
        
        # Allow relative URLs
        if url.startswith('/'):
            return not url.startswith('//')
        
        # Check absolute URLs
        parsed = urlparse(url)
        
        if not parsed.scheme or not parsed.netloc:
            return False
        
        # Only allow http(s)
        if parsed.scheme not in ('http', 'https'):
            return False
        
        # Check against allowed hosts
        if allowed_hosts and parsed.netloc not in allowed_hosts:
            return False
        
        return True
    
    @staticmethod
    def is_sql_injection_attempt(value):
        """
        Basic SQL injection detection.
        Note: Use ORM parameterized queries as primary defense.
        """
        if not isinstance(value, str):
            return False
        
        dangerous_patterns = [
            r"('\s*(OR|AND)\s*')",
            r'(;|\*|--|#)',
            r'(UNION\s+SELECT)',
            r'(DROP\s+TABLE)',
            r'(INSERT\s+INTO)',
            r'(UPDATE\s+)',
            r'(DELETE\s+FROM)',
        ]
        
        for pattern in dangerous_patterns:
            if re.search(pattern, value, re.IGNORECASE):
                return True
        
        return False
    
    @staticmethod
    def is_xss_attempt(value):
        """
        Basic XSS detection.
        Note: Use proper escaping and CSP as primary defense.
        """
        if not isinstance(value, str):
            return False
        
        dangerous_patterns = [
            r'<script[^>]*>',
            r'javascript:',
            r'on\w+\s*=',
            r'<iframe',
            r'<object',
            r'<embed',
            r'<img[^>]+src[^>]*onerror',
        ]
        
        for pattern in dangerous_patterns:
            if re.search(pattern, value, re.IGNORECASE):
                return True
        
        return False
