import importlib
import struct
from tempfile import TemporaryDirectory
import zlib

try:
    django_test = importlib.import_module("django.test")
    TestCase = django_test.TestCase
    override_settings = django_test.override_settings
except ImportError:
    from unittest import TestCase
    def override_settings(*args, **kwargs):
        return lambda func: func

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from .models import Product, ProductReview, ProductReviewImage, UserProfile, Message, ProductAudio
from .serializers import ProductSerializer


def _minimal_png():
    def chunk(chunk_type, data):
        content = chunk_type + data
        return struct.pack('>I', len(data)) + content + struct.pack('>I', zlib.crc32(content) & 0xFFFFFFFF)

    header = struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0)
    pixels = zlib.compress(b'\x00\xff\x00\x00')
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header) + chunk(b'IDAT', pixels) + chunk(b'IEND', b'')


class SimpleTestCase(TestCase):
    def test_basics(self):
        self.assertTrue(True)


class ProductSerializerTestCase(TestCase):
    def test_bird_category_requires_bird_type(self):
        serializer = ProductSerializer(
            data={
                'name': 'Test Bird',
                'price': '₹100',
                'description': 'A test bird listing',
                'category': 'Bird',
                'seller': 'seller',
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('bird_type', serializer.errors)

    def test_non_bird_category_allows_missing_bird_type(self):
        serializer = ProductSerializer(
            data={
                'name': 'Test Product',
                'price': '₹100',
                'description': 'A test listing',
                'category': 'Feed & Nutrition',
                'seller': 'seller',
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_livestock_category_requires_age(self):
        serializer = ProductSerializer(
            data={
                'name': 'Test Bird',
                'price': '₹100',
                'description': 'A test bird listing',
                'category': 'Bird',
                'bird_type': 'Pullet',
                'seller': 'seller',
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('age', serializer.errors)

    def test_cattel_category_requires_bird_type(self):
        serializer = ProductSerializer(
            data={
                'name': 'Test Cattel',
                'price': '₹100',
                'description': 'A test cattle listing',
                'category': 'Cattel',
                'seller': 'seller',
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('bird_type', serializer.errors)

    def test_bird_category_does_not_require_days_old_when_not_egg_chicks(self):
        serializer = ProductSerializer(
            data={
                'name': 'Test Bird',
                'price': '₹100',
                'description': 'A test bird listing',
                'category': 'Bird',
                'bird_type': 'Pullet',
                'age': '4 months',
                'seller': 'seller',
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)


class MessageViewTests(TestCase):
    def test_buyer_can_send_message_to_seller(self):
        buyer = User.objects.create_user(username='buyerchat', email='buyerchat@example.com', password='secret123')
        seller = User.objects.create_user(username='sellerchat', email='sellerchat@example.com', password='secret123')
        product = Product.objects.create(
            name='Chat Product',
            price='₹100',
            description='A test product',
            category='Feed & Nutrition',
            seller='sellerchat',
        )

        client = APIClient()
        client.force_authenticate(user=buyer)
        response = client.post('/api/messages/', {
            'recipient': seller.username,
            'content': 'Hi, is this still available?',
            'product_id': product.id,
        }, format='json')

        self.assertEqual(response.status_code, 201, response.content)
        self.assertTrue(Message.objects.filter(sender=buyer, recipient=seller, product=product).exists())

    def test_users_can_start_a_product_free_conversation(self):
        sender = User.objects.create_user(username='senderchat', password='secret123')
        recipient = User.objects.create_user(username='recipientchat', password='secret123')
        client = APIClient()
        client.force_authenticate(user=sender)

        response = client.post('/api/messages/', {
            'recipient': recipient.username,
            'content': 'Hello, I wanted to get in touch.',
        }, format='json')

        self.assertEqual(response.status_code, 201, response.content)
        self.assertTrue(Message.objects.filter(sender=sender, recipient=recipient, product__isnull=True).exists())


class ProductViewSetTestCase(TestCase):
    @override_settings(ALLOWED_HOSTS=['testserver'])
    def test_create_product_defaults_seller_to_authenticated_user(self):
        user = User.objects.create_user(username='seller', password='secret123')
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(
            '/api/products/',
            {
                'name': 'New Product',
                'price': '₹100',
                'quantity': 3,
                'description': 'Fresh eggs',
                'category': 'Feed & Nutrition',
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.data['seller'], 'seller')
        self.assertTrue(Product.objects.filter(name='New Product').exists())

    @override_settings(ALLOWED_HOSTS=['testserver'])
    def test_create_egg_and_chicks_product_without_model_files(self):
        user = User.objects.create_user(username='egg-seller', password='secret123')
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(
            '/api/products/',
            {
                'name': 'Farm Fresh Eggs',
                'price': '₹620',
                'price_per_item': '₹62',
                'quantity': 10,
                'description': 'Fresh farm eggs.',
                'category': 'Egg*Chicks',
                'bird_type': 'Breeding Hen',
                'age': '18 days',
                'days_old': '18',
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, 201, response.content)
        self.assertTrue(Product.objects.filter(name='Farm Fresh Eggs', seller='egg-seller').exists())

    @override_settings(ALLOWED_HOSTS=['testserver'])
    def test_create_egg_product_with_multiple_labeled_breeder_media(self):
        user = User.objects.create_user(username='breeder-seller', password='secret123')
        client = APIClient()
        client.force_authenticate(user=user)
        image_bytes = _minimal_png()

        with TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            response = client.post(
                '/api/products/',
                {
                    'name': 'Breeder Media Product',
                    'price': '₹100',
                    'price_per_item': '₹10',
                    'quantity': 10,
                    'description': 'Farm eggs with breeder media.',
                    'category': 'Egg*Chicks',
                    'bird_type': 'Breeding Hen',
                    'age': '1 year',
                    'days_old': '1',
                    'breeder_hen_images': [
                        SimpleUploadedFile('hen-one.png', image_bytes, content_type='image/png'),
                        SimpleUploadedFile('hen-two.png', image_bytes, content_type='image/png'),
                    ],
                    'breeder_rooster_videos': [
                        SimpleUploadedFile('rooster-one.mp4', b'rooster-video-one', content_type='video/mp4'),
                        SimpleUploadedFile('rooster-two.mp4', b'rooster-video-two', content_type='video/mp4'),
                    ],
                },
                format='multipart',
            )

        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(
            [image['alt_text'] for image in response.data['images']],
            ['Breeder hen photo - hen-one.png', 'Breeder hen photo - hen-two.png'],
        )
        self.assertEqual(
            [video['title'] for video in response.data['videos']],
            ['Breeder rooster video - rooster-one.mp4', 'Breeder rooster video - rooster-two.mp4'],
        )

    def test_seller_can_replace_product_image_when_updating(self):
        seller = User.objects.create_user(username='image-seller', password='secret123')
        product = Product.objects.create(
            name='Image Product',
            price='₹100',
            description='Fresh eggs',
            category='Feed & Nutrition',
            seller='image-seller',
        )
        Product.objects.get(id=product.id).images.create(
            image=SimpleUploadedFile('old.jpg', b'old-image-data', content_type='image/jpeg'),
            is_primary=True,
            order=0,
        )

        client = APIClient()
        client.force_authenticate(user=seller)
        updated_image = SimpleUploadedFile('new.jpg', b'new-image-data', content_type='image/jpeg')

        response = client.patch(
            f'/api/products/{product.id}/',
            {'image': updated_image},
            format='multipart',
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(product.images.count(), 1)
        self.assertTrue(product.images.filter(is_primary=True).exists())
        self.assertTrue(product.images.first().image.name.endswith('.jpg'))
        self.assertEqual(product.images.first().alt_text, 'new.jpg')

    def test_non_seller_cannot_delete_another_sellers_product(self):
        product = Product.objects.create(
            name='Protected Product',
            price='₹100',
            description='Fresh eggs',
            category='Feed & Nutrition',
            seller='owner-seller',
        )
        buyer = User.objects.create_user(username='buyer-user', password='secret123')
        client = APIClient()
        client.force_authenticate(user=buyer)

        response = client.delete(f'/api/products/{product.id}/')

        self.assertEqual(response.status_code, 403, response.content)
        self.assertTrue(Product.objects.filter(id=product.id).exists())

    def test_product_serializer_exposes_seller_contact_details(self):
        seller = User.objects.create_user(username='sellercontact', email='sellercontact@example.com', password='secret123')
        profile, _ = UserProfile.objects.get_or_create(user=seller)
        profile.phone = '+1234567890'
        profile.save()
        product = Product.objects.create(
            name='Contactable Product',
            price='₹100',
            description='Fresh eggs',
            category='Feed & Nutrition',
            seller='sellercontact',
        )

        serializer = ProductSerializer(instance=product)
        data = serializer.data

        self.assertEqual(data['seller_email'], 'sellercontact@example.com')
        self.assertEqual(data['seller_phone'], '+1234567890')


class ProductMediaUploadTestCase(TestCase):
    @override_settings(ALLOWED_HOSTS=['testserver'])
    def test_product_can_accept_multiple_audio_and_video_files(self):
        user = User.objects.create_user(username='media-seller', password='secret123')
        client = APIClient()
        client.force_authenticate(user=user)

        audio_file = SimpleUploadedFile('sample.mp3', b'fake-audio-data', content_type='audio/mpeg')
        video_file = SimpleUploadedFile('sample.mp4', b'fake-video-data', content_type='video/mp4')

        response = client.post(
            '/api/products/',
            {
                'name': 'Multi Media Product',
                'price': '₹299',
                'quantity': 2,
                'description': 'Has multiple media files',
                'category': 'Feed & Nutrition',
                'seller': 'media-seller',
                'audios': [audio_file],
                'videos': [video_file],
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(ProductAudio.objects.filter(product_id=response.data['id']).count(), 1)
        self.assertEqual(Product.objects.get(id=response.data['id']).videos.count(), 1)


class ProductReviewViewSetTestCase(TestCase):
    def test_buyer_can_post_review_with_images(self):
        product = Product.objects.create(
            name='Photo Product',
            price='₹100',
            description='A product with photos',
            category='Feed & Nutrition',
            seller='photo-seller',
        )
        buyer = User.objects.create_user(username='photo-buyer', password='secret123')
        client = APIClient()
        client.force_authenticate(user=buyer)
        image = SimpleUploadedFile('review.jpg', b'fake image data', content_type='image/jpeg')

        response = client.post(
            '/api/reviews/',
            {'product': product.id, 'rating': 5, 'comment': 'Looks great', 'images': [image]},
            format='multipart',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(ProductReviewImage.objects.filter(review_id=response.data['id']).count(), 1)
        self.assertEqual(len(response.data['images']), 1)

    def test_seller_reviews_include_all_products_for_that_seller(self):
        seller_product = Product.objects.create(
            name='Seller Product',
            price='₹100',
            description='A seller product',
            category='Feed & Nutrition',
            seller='reviewed-seller',
        )
        second_seller_product = Product.objects.create(
            name='Other Seller Product',
            price='₹100',
            description='Another product',
            category='Feed & Nutrition',
            seller='other-seller',
        )
        buyer = User.objects.create_user(username='review-buyer', password='secret123')
        ProductReview.objects.create(product=seller_product, buyer=buyer, rating=2, comment='Needs improvement')
        ProductReview.objects.create(product=second_seller_product, buyer=buyer, rating=5, comment='Excellent')

        response = APIClient().get('/api/reviews/?seller=reviewed-seller')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['product_name'], 'Seller Product')


class AddProductFromImageCommandTestCase(TestCase):
    def test_command_creates_product_with_media(self):
        from django.core.management import call_command
        import tempfile
        import base64
        from pathlib import Path

        # Tiny 1x1 JPEG base64
        jpeg_b64 = (
            '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBAQEA8QEBAQEA8QEA8PDw8QEA8QFREWFhUR'
            'FRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGhAQGi0lHyUtLS0tLS0tLS0t'
            'LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAKgBLAMBIgACEQEDEQH/xAAZ'
            'AAEBAQEBAQAAAAAAAAAAAAAABQYHCAP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAA'
            'AAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL8A//Z'
        )

        tmpdir = tempfile.mkdtemp()
        image_path = Path(tmpdir) / 'test_image.jpg'
        video_path = Path(tmpdir) / 'test_video.mp4'

        jpeg_b64 = jpeg_b64 + '=' * (-len(jpeg_b64) % 4)
        with open(image_path, 'wb') as f:
            f.write(base64.b64decode(jpeg_b64))

        # Create a small dummy video file (not a valid mp4 but acceptable for FileField tests)
        with open(video_path, 'wb') as f:
            f.write(b"\x00\x00\x00\x18ftypmp42")

        # Run management command
        call_command('add_product_from_image', '--image', str(image_path), '--video', str(video_path), '--name', 'CmdTestProduct')

        # Assert product created
        prod = Product.objects.filter(name='CmdTestProduct').first()
        self.assertIsNotNone(prod)
        self.assertTrue(prod.images.exists())
        # If video supported, should have video attached
        self.assertTrue(prod.videos.exists())

