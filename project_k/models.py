import uuid

from django.db import models  # type: ignore
from django.contrib.auth.models import User  # type: ignore
from django.db.models.signals import post_save  # type: ignore
from django.dispatch import receiver  # type: ignore
from Kukuta.storage import OptionalCloudinaryStorage

class Product(models.Model):
    BIRD_TYPE_CHOICES = [
        ('Breeding Hen', 'Breeding Hen'),
        ('Breeding Rooster', 'Breeding Rooster'),
        ('Fighting Roosters', 'Fighting Roosters'),
        ('Cockerels', 'Cockerels'),
        ('Pullet', 'Pullet'),
    ]

    name = models.CharField(max_length=200)
    price = models.CharField(max_length=20)  # Store as string like "₹12"
    price_per_item = models.CharField(max_length=20, blank=True, null=True)
    quantity = models.PositiveIntegerField(default=1)
    better_hen_model = models.FileField(upload_to='products/models/hens/', blank=True, null=True)
    rooster_model = models.FileField(upload_to='products/models/roosters/', blank=True, null=True)
    description = models.TextField()
    category = models.CharField(max_length=100)
    bird_type = models.CharField(max_length=50, choices=BIRD_TYPE_CHOICES, blank=True, null=True)
    age = models.CharField(max_length=50, blank=True, null=True)
    days_old = models.CharField(max_length=50, blank=True, null=True)
    seller = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['category', 'created_at'], name='product_category_created_idx'),
            models.Index(fields=['seller', 'created_at'], name='product_seller_created_idx'),
        ]

    def __str__(self):
        return self.name

class ProductImage(models.Model):
    product = models.ForeignKey(Product, related_name='images', on_delete=models.CASCADE)
    image = models.ImageField(
        upload_to='products/images/',
        storage=OptionalCloudinaryStorage('image'),
        blank=True,
        null=True,
    )
    image_url = models.URLField(blank=True, null=True)  # For external URLs or base64 data
    alt_text = models.CharField(max_length=200, blank=True, null=True)
    is_primary = models.BooleanField(default=False)  # Mark one image as primary
    order = models.PositiveIntegerField(default=0)  # For ordering images
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"Image for {self.product.name}"

class ProductVideo(models.Model):
    product = models.ForeignKey(Product, related_name='videos', on_delete=models.CASCADE)
    video = models.FileField(
        upload_to='products/videos/',
        storage=OptionalCloudinaryStorage('video'),
        blank=True,
        null=True,
    )
    video_url = models.URLField(blank=True, null=True)  # For external URLs or base64 data
    title = models.CharField(max_length=200, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    order = models.PositiveIntegerField(default=0)  # For ordering videos
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"Video for {self.product.name}"

class ProductAudio(models.Model):
    product = models.ForeignKey(Product, related_name='audios', on_delete=models.CASCADE)
    audio = models.FileField(upload_to='products/audios/', blank=True, null=True)
    audio_url = models.URLField(blank=True, null=True)
    title = models.CharField(max_length=200, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"Audio for {self.product.name}"

class UserProfile(models.Model):
    ROLE_CHOICES = [
        ('buyer', 'Buyer'),
        ('seller', 'Seller'),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='buyer')
    phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    state = models.CharField(max_length=100, blank=True, null=True)
    postal_code = models.CharField(max_length=20, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)
    profile_image = models.CharField(max_length=500, blank=True, null=True)  # URL or emoji
    is_verified = models.BooleanField(default=False)
    password_reset_otp = models.CharField(max_length=8, blank=True, null=True)
    password_reset_otp_expires_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} ({self.role})"

    class Meta:
        ordering = ['-created_at']

class UserCredential(models.Model):
    """Stores additional user login information and session data"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='credential')
    last_login_ip = models.GenericIPAddressField(blank=True, null=True)
    last_login_time = models.DateTimeField(blank=True, null=True)
    login_attempts = models.IntegerField(default=0)
    is_active_session = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Credentials for {self.user.username}"

    class Meta:
        ordering = ['-updated_at']


class Order(models.Model):
    STATUS_CHOICES = [
        ('pending_price', 'Awaiting price agreement'),
        ('confirmed', 'Confirmed'),
        ('processing', 'Processing'),
        ('shipped', 'Shipped'),
        ('delivered', 'Delivered'),
    ]

    buyer = models.ForeignKey(User, related_name='orders', on_delete=models.CASCADE)
    seller = models.ForeignKey(User, related_name='sales', on_delete=models.SET_NULL, null=True, blank=True)
    product = models.ForeignKey(Product, related_name='orders', on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    agreed_price = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    buyer_price_accepted = models.BooleanField(default=False)
    seller_price_accepted = models.BooleanField(default=False)
    agreement_key = models.CharField(max_length=120, unique=True, blank=True, null=True, editable=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='confirmed')
    tracking_number = models.CharField(max_length=40, unique=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['buyer', '-created_at'], name='order_buyer_created_idx'),
            models.Index(fields=['seller', '-created_at'], name='order_seller_created_idx'),
        ]

    def save(self, *args, **kwargs):
        if not self.tracking_number:
            prefix = 'KKT'
            base = self.product.name[:3].upper() if self.product_id else 'GEN'
            self.tracking_number = f'{prefix}-{base}-{uuid.uuid4().hex[:8].upper()}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.tracking_number} - {self.product.name}'


class Message(models.Model):
    sender = models.ForeignKey(User, related_name='sent_messages', on_delete=models.CASCADE)
    recipient = models.ForeignKey(User, related_name='received_messages', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, related_name='messages', on_delete=models.CASCADE, null=True, blank=True)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['sender', 'created_at'], name='message_sender_created_idx'),
            models.Index(fields=['recipient', 'created_at'], name='message_recipient_created_idx'),
        ]

    def __str__(self):
        return f"{self.sender.username} -> {self.recipient.username}: {self.content[:40]}"


class ProductReview(models.Model):
    product = models.ForeignKey(Product, related_name='reviews', on_delete=models.CASCADE)
    buyer = models.ForeignKey(User, related_name='product_reviews', on_delete=models.CASCADE)
    rating = models.PositiveSmallIntegerField()
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['product', '-created_at'], name='review_product_created_idx'),
        ]
        constraints = [
            models.UniqueConstraint(fields=['product', 'buyer'], name='one_review_per_buyer_product'),
        ]

    def __str__(self):
        return f"{self.product.name} review by {self.buyer.username}"


class ProductReviewImage(models.Model):
    review = models.ForeignKey(ProductReview, related_name='images', on_delete=models.CASCADE)
    image = models.ImageField(
        upload_to='products/reviews/',
        storage=OptionalCloudinaryStorage('image'),
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Image for {self.review}"

@receiver(post_save, sender=User)
def ensure_user_profile(sender, instance, created, **kwargs):
    """Create UserProfile and UserCredential when a new User is created"""
    if created:
        UserProfile.objects.create(user=instance)
        UserCredential.objects.create(user=instance)
    else:
        UserProfile.objects.get_or_create(user=instance)
        UserCredential.objects.get_or_create(user=instance)
