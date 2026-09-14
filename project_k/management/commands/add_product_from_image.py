from django.core.management.base import BaseCommand
from django.core.files import File
from django.utils import timezone
import os

from project_k.models import Product, ProductImage, ProductVideo


class Command(BaseCommand):
    help = 'Create a Product and attach an image file to it'

    def add_arguments(self, parser):
        parser.add_argument('--name', default='Patta', help='Product name')
        parser.add_argument('--price', default='TBD', help='Price string')
        parser.add_argument('--description', default='Rooster', help='Product description')
        parser.add_argument('--category', default='Poultry', help='Product category')
        parser.add_argument('--quantity', type=int, default=1, help='Quantity')
        parser.add_argument('--image', required=True, help='Path to local image file to attach')
        parser.add_argument('--seller', default=None, help='Seller name')
        parser.add_argument('--bird_type', default=None, help='Bird type choice')
        parser.add_argument('--video', required=False, help='Path to local video file to attach')
        parser.add_argument('--video_title', default=None, help='Video title')
        parser.add_argument('--video_description', default=None, help='Video description')

    def handle(self, *args, **options):
        image_path = options['image']
        name = options['name']
        price = options['price']
        description = options['description']
        category = options['category']
        quantity = options['quantity']
        seller = options.get('seller')
        bird_type = options.get('bird_type')

        if not os.path.exists(image_path):
            self.stderr.write(f"Image file not found: {image_path}")
            return

        # Create product
        product = Product.objects.create(
            name=name,
            price=price,
            description=description,
            category=category,
            quantity=quantity,
            seller=seller if seller else '',
            bird_type=bird_type if bird_type else None,
        )

        # Attach image
        with open(image_path, 'rb') as f:
            django_file = File(f)
            img = ProductImage(product=product, alt_text=f"{name} image", is_primary=True, created_at=timezone.now())
            img.image.save(os.path.basename(image_path), django_file, save=True)

        # Attach video if provided
        video_path = options.get('video')
        if video_path:
            if not os.path.exists(video_path):
                self.stderr.write(f"Video file not found: {video_path}")
            else:
                with open(video_path, 'rb') as vf:
                    vfile = File(vf)
                    pv = ProductVideo(product=product, title=options.get('video_title') or f"{name} video", description=options.get('video_description') or '')
                    pv.video.save(os.path.basename(video_path), vfile, save=True)

        self.stdout.write(self.style.SUCCESS(f"Created product id={product.id} name='{product.name}' and attached image '{os.path.basename(image_path)}'."))
