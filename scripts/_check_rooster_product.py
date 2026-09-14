import os
import sys
import django

# Ensure repo root is on sys.path so imports like Kukuta.settings work
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Kukuta.settings')
django.setup()

from project_k.models import Product

exists = Product.objects.filter(pk=9999).exists()
print('EXISTS:', exists)
if exists:
    p = Product.objects.get(pk=9999)
    print('PRODUCT:', p.pk, p.name, p.category, p.price)
    images = list(p.images.all())
    print('IMAGES:', [(img.pk, img.image.name if img.image else img.image_url) for img in images])
