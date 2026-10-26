import json
import os
import secrets
import base64
from decimal import Decimal, InvalidOperation
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from urllib.parse import urlparse

from django.contrib.auth import authenticate, login
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password, ValidationError
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.views.decorators.csrf import ensure_csrf_cookie
from datetime import timedelta
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.conf import settings
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Product, UserProfile, ProductImage, ProductVideo, ProductAudio, UserCredential, Message, ProductReview, ProductReviewImage, Order
from .serializers import ProductSerializer, ProductImageSerializer, ProductVideoSerializer, ProductAudioSerializer, MessageSerializer, ProductReviewSerializer, OrderSerializer

ALLOWED_IMAGE_TYPES = {
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
}
ALLOWED_VIDEO_TYPES = {
    'video/mp4',
    'video/webm',
    'video/ogg',
}
ALLOWED_AUDIO_TYPES = {
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
    'audio/mp4',
    'audio/m4a',
}
ALLOWED_MODEL_EXTENSIONS = {'.glb', '.gltf', '.obj', '.fbx', '.usdz'}


def is_safe_external_url(url):
    if not url:
        return False
    parsed = urlparse(url)
    return parsed.scheme in ('http', 'https') and bool(parsed.netloc)


def validate_uploaded_file(uploaded_file, allowed_types=None, allowed_extensions=None, max_size=20 * 1024 * 1024):
    if uploaded_file is None:
        return True
    if uploaded_file.size > max_size:
        return False
    if allowed_types and uploaded_file.content_type:
        if uploaded_file.content_type not in allowed_types:
            return False
    if allowed_extensions:
        name = uploaded_file.name.lower()
        if not any(name.endswith(ext) for ext in allowed_extensions):
            return False
    return True


def generate_otp(length=6):
    return ''.join(secrets.choice('0123456789') for _ in range(length))


def send_sms_otp(phone, otp):
    account_sid = getattr(settings, 'TWILIO_ACCOUNT_SID', '')
    auth_token = getattr(settings, 'TWILIO_AUTH_TOKEN', '')
    from_number = getattr(settings, 'TWILIO_FROM_NUMBER', '')
    if not all((account_sid, auth_token, from_number)):
        print(f"Password reset OTP for {phone}: {otp}")
        return

    payload = urlencode({
        'To': phone,
        'From': from_number,
        'Body': f'Your Kukuta password reset OTP is {otp}. It expires in 5 minutes.',
    }).encode()
    credentials = base64.b64encode(f'{account_sid}:{auth_token}'.encode()).decode()
    request = Request(
        f'https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json',
        data=payload,
        headers={'Authorization': f'Basic {credentials}'},
        method='POST',
    )
    with urlopen(request, timeout=10):
        return


class ProductViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedOrReadOnly]
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

    def get_queryset(self):
        return Product.objects.prefetch_related('images', 'videos', 'audios')

    def create(self, request, *args, **kwargs):
        # Handle both FormData and JSON
        if request.content_type.startswith('multipart/form-data'):
            # Handle FormData
            data = request.data.copy()
            images_data = []
            videos_data = []
            audios_data = []

            # Validate model file uploads
            if not validate_uploaded_file(request.FILES.get('better_hen_model'), allowed_extensions=ALLOWED_MODEL_EXTENSIONS, max_size=20 * 1024 * 1024):
                return Response({'error': 'Invalid better_hen_model upload.'}, status=status.HTTP_400_BAD_REQUEST)
            if not validate_uploaded_file(request.FILES.get('rooster_model'), allowed_extensions=ALLOWED_MODEL_EXTENSIONS, max_size=20 * 1024 * 1024):
                return Response({'error': 'Invalid rooster_model upload.'}, status=status.HTTP_400_BAD_REQUEST)

            # Extract image files
            image_files = request.FILES.getlist('images')
            for i, image_file in enumerate(image_files):
                if not validate_uploaded_file(image_file, allowed_types=ALLOWED_IMAGE_TYPES, max_size=10 * 1024 * 1024):
                    return Response({'error': 'Invalid image upload.'}, status=status.HTTP_400_BAD_REQUEST)
                images_data.append({
                    'image': image_file,
                    'order': i,
                    'is_primary': i == 0,  # First image is primary
                })

            # Extract image URLs
            image_urls = []
            for key, value in data.items():
                if key.startswith('image_urls['):
                    image_urls.append(value)
            for i, url in enumerate(image_urls):
                if url.strip():
                    if not is_safe_external_url(url):
                        return Response({'error': 'Invalid external image URL.'}, status=status.HTTP_400_BAD_REQUEST)
                    images_data.append({
                        'image_url': url,
                        'order': len(image_files) + i,
                        'is_primary': len(image_files) == 0 and i == 0,
                    })

            for media_key, label in (
                ('breeder_hen_images', 'Breeder hen'),
                ('breeder_rooster_images', 'Breeder rooster'),
            ):
                for image_file in request.FILES.getlist(media_key):
                    if not validate_uploaded_file(image_file, allowed_types=ALLOWED_IMAGE_TYPES, max_size=10 * 1024 * 1024):
                        return Response({'error': f'Invalid {label.lower()} image upload.'}, status=status.HTTP_400_BAD_REQUEST)
                    images_data.append({
                        'image': image_file,
                        'alt_text': f'{label} photo - {image_file.name}',
                        'order': len(images_data),
                        'is_primary': not images_data,
                    })

            # Extract video files
            video_files = request.FILES.getlist('videos')
            for i, video_file in enumerate(video_files):
                if not validate_uploaded_file(video_file, allowed_types=ALLOWED_VIDEO_TYPES, max_size=100 * 1024 * 1024):
                    return Response({'error': 'Invalid video upload.'}, status=status.HTTP_400_BAD_REQUEST)
                videos_data.append({
                    'video': video_file,
                    'order': i,
                })

            # Extract video URLs
            video_urls = []
            for key, value in data.items():
                if key.startswith('video_urls['):
                    video_urls.append(value)
            for i, url in enumerate(video_urls):
                if url.strip():
                    if not is_safe_external_url(url):
                        return Response({'error': 'Invalid external video URL.'}, status=status.HTTP_400_BAD_REQUEST)
                    videos_data.append({
                        'video_url': url,
                        'order': len(video_files) + i,
                    })

            for media_key, label in (
                ('breeder_hen_videos', 'Breeder hen'),
                ('breeder_rooster_videos', 'Breeder rooster'),
            ):
                for video_file in request.FILES.getlist(media_key):
                    if not validate_uploaded_file(video_file, allowed_types=ALLOWED_VIDEO_TYPES, max_size=100 * 1024 * 1024):
                        return Response({'error': f'Invalid {label.lower()} video upload.'}, status=status.HTTP_400_BAD_REQUEST)
                    videos_data.append({
                        'video': video_file,
                        'title': f'{label} video - {video_file.name}',
                        'order': len(videos_data),
                    })

            # Extract audio files
            audio_files = request.FILES.getlist('audios')
            for i, audio_file in enumerate(audio_files):
                if not validate_uploaded_file(audio_file, allowed_types=ALLOWED_AUDIO_TYPES, max_size=20 * 1024 * 1024):
                    return Response({'error': 'Invalid audio upload.'}, status=status.HTTP_400_BAD_REQUEST)
                audios_data.append({
                    'audio': audio_file,
                    'order': i,
                })

            # Extract audio URLs
            audio_urls = []
            for key, value in data.items():
                if key.startswith('audio_urls['):
                    audio_urls.append(value)
            for i, url in enumerate(audio_urls):
                if url.strip():
                    if not is_safe_external_url(url):
                        return Response({'error': 'Invalid external audio URL.'}, status=status.HTTP_400_BAD_REQUEST)
                    audios_data.append({
                        'audio_url': url,
                        'order': len(audio_files) + i,
                    })

            # Create the product
            product_data = {
                'name': data.get('name'),
                'price': data.get('price'),
                'price_per_item': data.get('price_per_item'),
                'quantity': data.get('quantity', 1),
                'better_hen_model': request.FILES.get('better_hen_model'),
                'rooster_model': request.FILES.get('rooster_model'),
                'description': data.get('description'),
                'category': data.get('category'),
                'bird_type': data.get('bird_type'),
                'age': data.get('age'),
                'days_old': data.get('days_old'),
                'seller': data.get('seller') or getattr(request.user, 'username', None),
            }
        else:
            # Handle JSON (legacy support)
            data = request.data.copy()
            images_data = data.pop('images', [])
            videos_data = data.pop('videos', [])
            audios_data = data.pop('audios', [])
            product_data = data
            if not product_data.get('seller'):
                product_data['seller'] = getattr(request.user, 'username', None)

        if product_data.get('category') in {'Bird', 'Cattel', 'Egg*Chicks'} and not product_data.get('bird_type'):
            return Response({'error': 'Animal products require a type selection.'}, status=status.HTTP_400_BAD_REQUEST)

        if product_data.get('category') in {'Bird', 'Cattel', 'Egg*Chicks'} and not product_data.get('age'):
            return Response({'error': 'Livestock products require an age value.'}, status=status.HTTP_400_BAD_REQUEST)

        if product_data.get('category') == 'Egg*Chicks' and not product_data.get('days_old'):
            return Response({'error': 'Egg*Chicks products require the number of days old.'}, status=status.HTTP_400_BAD_REQUEST)

        # Create the product
        serializer = self.get_serializer(data=product_data)
        serializer.is_valid(raise_exception=True)
        product = serializer.save()

        # Handle images
        for image_data in images_data:
            image_data['product'] = product.id
            image_serializer = ProductImageSerializer(data=image_data)
            if image_serializer.is_valid():
                image_serializer.save()

        # Handle videos
        for video_data in videos_data:
            video_data['product'] = product.id
            video_serializer = ProductVideoSerializer(data=video_data)
            if video_serializer.is_valid():
                video_serializer.save()

        # Handle audios
        for audio_data in audios_data:
            audio_data['product'] = product.id
            audio_serializer = ProductAudioSerializer(data=audio_data)
            if audio_serializer.is_valid():
                audio_serializer.save()

        # Return the product with images, videos, and audios
        serializer = self.get_serializer(product)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        product = self.get_object()
        if not request.user.is_authenticated or product.seller != request.user.username:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only the product owner can edit this product.')

        image_file = request.FILES.get('image')
        image_url = request.data.get('image_url')

        if image_file and not validate_uploaded_file(image_file, allowed_types=ALLOWED_IMAGE_TYPES, max_size=10 * 1024 * 1024):
            return Response({'error': 'Invalid image upload.'}, status=status.HTTP_400_BAD_REQUEST)
        if image_url and not is_safe_external_url(image_url):
            return Response({'error': 'Invalid external image URL.'}, status=status.HTTP_400_BAD_REQUEST)

        cleaned_data = request.data.copy()
        for key in ['image', 'image_url', 'images', 'videos', 'better_hen_model', 'rooster_model']:
            cleaned_data.pop(key, None)

        serializer = self.get_serializer(product, data=cleaned_data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(seller=product.seller)

        if image_file or image_url:
            existing_images = list(product.images.order_by('order', 'created_at'))
            if existing_images:
                primary_image = existing_images[0]
                if image_file:
                    primary_image.image = image_file
                    primary_image.image_url = None
                    primary_image.alt_text = image_file.name
                    primary_image.is_primary = True
                    primary_image.save(update_fields=['image', 'image_url', 'alt_text', 'is_primary'])
                else:
                    primary_image.image = None
                    primary_image.image_url = image_url
                    primary_image.alt_text = 'Product image'
                    primary_image.is_primary = True
                    primary_image.save(update_fields=['image', 'image_url', 'alt_text', 'is_primary'])
            else:
                ProductImage.objects.create(
                    product=product,
                    image=image_file,
                    image_url=image_url,
                    alt_text=image_file.name if image_file else 'Product image',
                    is_primary=True,
                    order=0,
                )

        response_data = self.get_serializer(product).data
        return Response(response_data)

    def perform_update(self, serializer):
        product = self.get_object()
        if not self.request.user.is_authenticated or product.seller != self.request.user.username:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only the product owner can edit this product.')
        serializer.save(seller=product.seller)

    def perform_destroy(self, instance):
        if not self.request.user.is_authenticated or instance.seller != self.request.user.username:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only the product owner can delete this product.')
        instance.delete()

    @action(detail=True, methods=['post'])
    def add_image(self, request, pk=None):
        product = self.get_object()
        data = request.data.copy()
        image_file = request.FILES.get('image')
        image_url = data.get('image_url')

        if image_file and not validate_uploaded_file(image_file, allowed_types=ALLOWED_IMAGE_TYPES, max_size=10 * 1024 * 1024):
            return Response({'error': 'Invalid image upload.'}, status=status.HTTP_400_BAD_REQUEST)
        if image_url and not is_safe_external_url(image_url):
            return Response({'error': 'Invalid external image URL.'}, status=status.HTTP_400_BAD_REQUEST)

        data['product'] = product.id

        # If no order specified, add to the end
        if 'order' not in data:
            existing_images = ProductImage.objects.filter(product=product)
            data['order'] = existing_images.count()

        # If this is the first image, make it primary
        if not ProductImage.objects.filter(product=product, is_primary=True).exists():
            data['is_primary'] = True

        serializer = ProductImageSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def add_video(self, request, pk=None):
        product = self.get_object()
        data = request.data.copy()
        video_file = request.FILES.get('video')
        video_url = data.get('video_url')

        if video_file and not validate_uploaded_file(video_file, allowed_types=ALLOWED_VIDEO_TYPES, max_size=50 * 1024 * 1024):
            return Response({'error': 'Invalid video upload.'}, status=status.HTTP_400_BAD_REQUEST)
        if video_url and not is_safe_external_url(video_url):
            return Response({'error': 'Invalid external video URL.'}, status=status.HTTP_400_BAD_REQUEST)

        data['product'] = product.id

        # If no order specified, add to the end
        if 'order' not in data:
            existing_videos = ProductVideo.objects.filter(product=product)
            data['order'] = existing_videos.count()

        serializer = ProductVideoSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def csrf_token_view(request):
    return Response({'detail': 'CSRF cookie set'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user_view(request):
    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    return Response({
        'id': request.user.id,
        'username': request.user.username,
        'email': request.user.email,
        'name': request.user.username,
        'role': profile.role,
    })


class MessageViewSet(viewsets.ModelViewSet):
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return (Message.objects.filter(sender=user) | Message.objects.filter(recipient=user)).select_related(
            'sender', 'recipient', 'product'
        )

    def create(self, request, *args, **kwargs):
        recipient_name = request.data.get('recipient')
        if not recipient_name:
            return Response({'error': 'recipient is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            recipient = User.objects.get(username=recipient_name)
        except User.DoesNotExist:
            return Response({'error': 'recipient not found'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data.copy()
        data['recipient'] = recipient.id

        serializer = self.get_serializer(data=data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        message = serializer.save(recipient=recipient)
        return Response(self.get_serializer(message).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        message = self.get_object()
        if message.recipient_id != request.user.id:
            return Response({'error': 'Only the recipient can mark a message as read.'}, status=status.HTTP_403_FORBIDDEN)
        message.is_read = True
        message.save(update_fields=['is_read'])
        return Response(self.get_serializer(message).data)


class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.select_related('buyer', 'seller', 'product').all()
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return (Order.objects.filter(buyer=user) | Order.objects.filter(seller=user)).exclude(
            status='pending_price'
        ).select_related('buyer', 'seller', 'product')

    def create(self, request, *args, **kwargs):
        return Response(
            {'error': 'An order is created only after the buyer and seller accept the same price in chat.'},
            status=status.HTTP_409_CONFLICT,
        )

    @action(detail=False, methods=['get', 'post'], url_path='price-agreement')
    def price_agreement(self, request):
        product_id = request.query_params.get('product_id') if request.method == 'GET' else request.data.get('product_id')
        participant_name = request.query_params.get('participant') if request.method == 'GET' else request.data.get('participant')
        if not product_id:
            return Response({'error': 'product_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            product = Product.objects.get(pk=product_id)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)

        seller = User.objects.filter(username__iexact=(product.seller or '')).first()
        if seller is None:
            return Response({'error': 'This product does not have an active seller account.'}, status=status.HTTP_400_BAD_REQUEST)

        if request.user.pk == seller.pk:
            buyer = User.objects.filter(username__iexact=(participant_name or '')).first()
            if buyer is None or buyer.pk == seller.pk:
                return Response({'error': 'A different chat participant is required.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            if participant_name and participant_name.casefold() != seller.username.casefold():
                return Response({'error': 'This participant is not part of the product conversation.'}, status=status.HTTP_403_FORBIDDEN)
            buyer = request.user

        if request.method == 'GET':
            order = Order.objects.filter(product=product, buyer=buyer, seller=seller).order_by('-created_at').first()
            if order is None:
                return Response({
                    'product': product.pk,
                    'product_name': product.name,
                    'buyer_name': buyer.username,
                    'seller_name': seller.username,
                    'agreed_price': None,
                    'buyer_price_accepted': False,
                    'seller_price_accepted': False,
                    'status': 'not_started',
                })
            return Response(self.get_serializer(order).data)

        try:
            agreed_price = Decimal(str(request.data.get('agreed_price', '')).strip())
        except (InvalidOperation, TypeError, ValueError):
            return Response({'error': 'Enter a valid agreed price.'}, status=status.HTTP_400_BAD_REQUEST)
        if not agreed_price.is_finite() or agreed_price <= 0 or agreed_price.as_tuple().exponent < -2 or agreed_price >= Decimal('10000000000'):
            return Response({'error': 'Agreed price must be greater than zero and have at most two decimal places.'}, status=status.HTTP_400_BAD_REQUEST)

        order_id = request.data.get('order_id')
        agreement_key = f'{product.pk}:{buyer.pk}:{seller.pk}'
        with transaction.atomic():
            if order_id:
                order = Order.objects.select_for_update().filter(
                    pk=order_id, product=product, buyer=buyer, seller=seller
                ).first()
                if order is None:
                    return Response({'error': 'Price agreement not found.'}, status=status.HTTP_404_NOT_FOUND)
                if order.status == 'confirmed':
                    if order.agreed_price == agreed_price:
                        return Response(self.get_serializer(order).data)
                    return Response({'error': 'This order is already confirmed. Start a new price agreement.'}, status=status.HTTP_409_CONFLICT)
            else:
                order, _ = Order.objects.select_for_update().get_or_create(
                    agreement_key=agreement_key,
                    defaults={
                        'product': product,
                        'buyer': buyer,
                        'seller': seller,
                        'quantity': 1,
                        'agreed_price': agreed_price,
                        'status': 'pending_price',
                    },
                )

            if order.agreed_price != agreed_price:
                order.agreed_price = agreed_price
                order.buyer_price_accepted = False
                order.seller_price_accepted = False

            if request.user.pk == buyer.pk:
                order.buyer_price_accepted = True
            else:
                order.seller_price_accepted = True

            order.status = 'confirmed' if order.buyer_price_accepted and order.seller_price_accepted else 'pending_price'
            if order.status == 'confirmed':
                order.agreement_key = None
            order.save(update_fields=[
                'agreed_price', 'buyer_price_accepted', 'seller_price_accepted', 'agreement_key', 'status', 'updated_at'
            ])

        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        order = self.get_object()
        status_value = request.data.get('status')
        if status_value not in dict(Order.STATUS_CHOICES):
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        if request.user != order.buyer and request.user != order.seller:
            return Response({'error': 'You cannot update this order'}, status=status.HTTP_403_FORBIDDEN)

        order.status = status_value
        order.notes = request.data.get('notes', order.notes)
        order.save(update_fields=['status', 'notes', 'updated_at'])
        return Response(self.get_serializer(order).data)


class ProductReviewViewSet(viewsets.ModelViewSet):
    queryset = ProductReview.objects.select_related('buyer', 'product').prefetch_related('images').all()
    serializer_class = ProductReviewSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        product_id = self.request.query_params.get('product')
        seller = (self.request.query_params.get('seller') or '').strip()

        if product_id:
            queryset = queryset.filter(product_id=product_id)
        if seller:
            queryset = queryset.filter(product__seller__iexact=seller).distinct()

        return queryset

    def perform_create(self, serializer):
        if getattr(self.request.user, 'profile', None) and self.request.user.profile.role != 'buyer':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only buyers can add product reviews.')
        image_files = self.request.FILES.getlist('images')
        if len(image_files) > 5:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'images': 'You can upload up to 5 review images.'})
        for image_file in image_files:
            if not validate_uploaded_file(image_file, allowed_types=ALLOWED_IMAGE_TYPES, max_size=10 * 1024 * 1024):
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'images': 'Each review image must be a valid image under 10 MB.'})
        review = serializer.save(buyer=self.request.user)
        ProductReviewImage.objects.bulk_create(
            [ProductReviewImage(review=review, image=image_file) for image_file in image_files]
        )

    def perform_update(self, serializer):
        from rest_framework.exceptions import PermissionDenied
        review = self.get_object()
        if review.buyer_id != self.request.user.id:
            raise PermissionDenied('Only the buyer who wrote this review can edit it.')
        if getattr(self.request.user, 'profile', None) and self.request.user.profile.role != 'buyer':
            raise PermissionDenied('Only buyers can edit product reviews.')
        serializer.save(buyer=review.buyer)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AnonRateThrottle, UserRateThrottle])
def login_view(request):
    identifier = request.data.get('identifier') or request.data.get('username')
    password = request.data.get('password')

    if not identifier or not password:
        return Response({'error': 'Username/email/mobile and password are required'}, status=status.HTTP_400_BAD_REQUEST)

    # Try to authenticate with username first, then email, then mobile phone
    user = authenticate(username=identifier, password=password)
    if user is None:
        try:
            user_obj = User.objects.get(email__iexact=identifier)
            user = authenticate(username=user_obj.username, password=password)
        except User.DoesNotExist:
            user = None

    if user is None:
        try:
            profile = UserProfile.objects.get(phone__iexact=identifier)
            user = authenticate(username=profile.user.username, password=password)
        except UserProfile.DoesNotExist:
            user = None

    if user is None:
        try:
            user_attempt = User.objects.filter(username__iexact=identifier).first()
            if not user_attempt:
                profile = UserProfile.objects.filter(phone__iexact=identifier).select_related('user').first()
                user_attempt = profile.user if profile else None
            if user_attempt:
                cred, _ = UserCredential.objects.get_or_create(user=user_attempt)
                cred.login_attempts = min(cred.login_attempts + 1, 10)
                cred.save()
        except Exception:
            pass
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

    profile, _ = UserProfile.objects.get_or_create(user=user)
    credential, _ = UserCredential.objects.get_or_create(user=user)
    if credential.login_attempts >= 5 and credential.last_login_time and timezone.now() - credential.last_login_time < timedelta(minutes=15):
        return Response({'error': 'Account temporarily locked due to too many failed login attempts. Please try again later.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)

    login(request, user)
    credential.last_login_ip = request.META.get('REMOTE_ADDR')
    credential.last_login_time = timezone.now()
    credential.login_attempts = 0
    credential.is_active_session = True
    credential.save()

    refresh = RefreshToken.for_user(user)
    tokens = {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    }

    return Response({
        'message': 'Login successful',
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': profile.role,
            'is_staff': user.is_staff,
        },
        'tokens': tokens,
    }, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AnonRateThrottle, UserRateThrottle])
def signup_view(request):
    username = request.data.get('username')
    email = request.data.get('email')
    password = request.data.get('password')
    name = request.data.get('name')
    role = request.data.get('role', 'buyer')
    # Basic validation
    errors = {}
    if not username:
        errors['username'] = 'Username is required'
    if not email:
        errors['email'] = 'Email is required'
    if not password:
        errors['password'] = 'Password is required'
    if errors:
        return Response({'errors': errors}, status=status.HTTP_400_BAD_REQUEST)

    # Normalize and uniqueness checks (case-insensitive for email)
    if User.objects.filter(username__iexact=username).exists():
        return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email__iexact=email).exists():
        return Response({'error': 'Email already exists'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        validate_password(password)
    except ValidationError as validation_error:
        return Response({'errors': {'password': validation_error.messages}}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(username=username, email=email, password=password, first_name=name or '')
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.role = role if role in ['buyer', 'seller'] else 'buyer'
    profile.save()

    # Return created user info
    # Generate tokens for the new user (auto-login)
    refresh = RefreshToken.for_user(user)
    tokens = {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    }

    return Response({'message': 'User created successfully', 'user': {'id': user.id, 'username': user.username, 'email': user.email, 'role': profile.role}, 'tokens': tokens}, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AnonRateThrottle, UserRateThrottle])
def password_reset_view(request):
    # Accept either 'identifier' (preferred) or legacy 'email' key from clients/tests
    identifier = (request.data.get('identifier') or request.data.get('email') or '').strip()
    user = None
    profile = None

    if '@' in identifier:
        try:
            user = User.objects.get(email__iexact=identifier)
            profile, _ = UserProfile.objects.get_or_create(user=user)
        except User.DoesNotExist:
            user = None
    else:
        try:
            profile = UserProfile.objects.get(phone__iexact=identifier)
            user = profile.user
        except UserProfile.DoesNotExist:
            user = None

    # Always return a success message to avoid leaking account existence
    # If the user/profile cannot be found, return the generic message.
    if user is None or profile is None:
        return Response({'message': 'If that account exists, password reset instructions have been sent.'})

    otp = generate_otp(6)
    profile.password_reset_otp = otp
    profile.password_reset_otp_expires_at = timezone.now() + timedelta(minutes=5)
    profile.save()

    token = default_token_generator.make_token(user)
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    expires_at = profile.password_reset_otp_expires_at.isoformat()
    frontend_url = (
        getattr(settings, 'FRONTEND_URL', None)
        or os.environ.get('FRONTEND_URL')
    )
    vite_url = getattr(settings, 'VITE_DEV_SERVER_URL', None) or os.environ.get('VITE_DEV_SERVER_URL')
    if getattr(settings, 'DEBUG', False) and vite_url:
        frontend_url = vite_url
    if not frontend_url:
        frontend_url = request.build_absolute_uri('/')
    if frontend_url.endswith('/static/'):
        frontend_url = frontend_url[:-8]
    elif frontend_url.endswith('/static'):
        frontend_url = frontend_url[:-6]
    reset_link = (
        f"{frontend_url.rstrip('/')}/password-reset-confirm/{uid}/{token}/"
        f"?{urlencode({'expires_at': expires_at})}"
    )

    if '@' in identifier and user.email:
        send_mail(
            'Password Reset OTP',
            f'Your Kukuta password reset code is {otp}. It expires in 5 minutes. Use this link to reset your password: {reset_link}',
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False,
            html_message=render_to_string('project_k/password_reset_otp_email.html', {
                'otp': otp,
                'reset_link': reset_link,
                'expiry_minutes': 5,
            }),
        )
    else:
        send_sms_otp(profile.phone, otp)

    return Response({
        'message': 'If that account exists, password reset instructions have been sent.',
        'reset_link': reset_link,
        'uid': uid,
        'token': token,
        'expires_at': expires_at,
    })

@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AnonRateThrottle, UserRateThrottle])
def password_reset_confirm_view(request, uidb64, token):
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None

    if user is None or not default_token_generator.check_token(user, token):
        return Response({'error': 'Invalid token'}, status=status.HTTP_400_BAD_REQUEST)

    identifier = (request.data.get('identifier') or '').strip()
    otp = (request.data.get('otp') or '').strip()
    if not identifier:
        return Response({'error': 'Email or phone identifier is required'}, status=status.HTTP_400_BAD_REQUEST)
    if not otp:
        return Response({'error': 'OTP is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        profile = UserProfile.objects.get(user=user)
    except UserProfile.DoesNotExist:
        return Response({'error': 'Identifier does not match user contact information'}, status=status.HTTP_400_BAD_REQUEST)

    if '@' in identifier:
        if not user.email or user.email.lower() != identifier.lower():
            return Response({'error': 'Identifier does not match user email'}, status=status.HTTP_400_BAD_REQUEST)
    else:
        if not profile.phone or profile.phone.strip() != identifier.strip():
            return Response({'error': 'Identifier does not match user phone number'}, status=status.HTTP_400_BAD_REQUEST)

    if not profile.password_reset_otp or profile.password_reset_otp != otp:
        return Response({'error': 'Invalid OTP'}, status=status.HTTP_400_BAD_REQUEST)
    if not profile.password_reset_otp_expires_at or profile.password_reset_otp_expires_at <= timezone.now():
        return Response({'error': 'OTP has expired'}, status=status.HTTP_400_BAD_REQUEST)

    new_password = request.data.get('new_password')
    if new_password:
        user.set_password(new_password)
        user.save()
        profile.password_reset_otp = None
        profile.password_reset_otp_expires_at = None
        profile.save()
        return Response({'message': 'Password reset successful'})
    return Response({'error': 'New password required'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([UserRateThrottle])
def role_toggle_view(request):
    # Prefer the authenticated user for self role changes. If a different
    # username is provided, only staff may change another user's role.
    new_role = request.data.get('role')
    if not new_role:
        return Response({'error': 'Role is required'}, status=status.HTTP_400_BAD_REQUEST)

    if new_role not in ['buyer', 'seller']:
        return Response({'error': 'Invalid role'}, status=status.HTTP_400_BAD_REQUEST)

    # default target is the authenticated user
    if not request.user or not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    target_user = request.user
    username = request.data.get('username')
    if username and username != request.user.username:
        # only staff can change other users' roles
        if not request.user.is_staff:
            return Response({'error': 'Admin privileges required to change other users'}, status=status.HTTP_403_FORBIDDEN)
        try:
            target_user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    profile, _ = UserProfile.objects.get_or_create(user=target_user)
    profile.role = new_role
    profile.save()
    return Response({'message': 'Role updated successfully', 'role': new_role})

