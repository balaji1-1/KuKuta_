from django.core.management.base import BaseCommand
from project_k.models import Product

class Command(BaseCommand):
    help = 'Populate the database with initial product data'

    def handle(self, *args, **options):
        products_data = [
            {
                'name': 'Farm Fresh Eggs',
                'price': '₹12',
                'description': 'Organic eggs from healthy, free-range hens. Packed with nutrients.',
                'image': '🥚',
                'category': 'Egg*Chicks',
            },
            {
                'name': 'Premium Layer Feed',
                'price': '₹24',
                'description': 'Nutrient-rich feed for optimal egg production and hen health.',
                'image': '🌾',
                'category': 'Feed & Nutrition',
            },
            {
                'name': 'Chicken Coop (Large)',
                'price': '₹189',
                'description': 'Spacious wooden coop with nesting boxes for up to 8 hens.',
                'image': '🏠',
                'category': 'Housing & Shelter',
            },
            {
                'name': 'Automatic Water Feeder',
                'price': '₹45',
                'description': 'Self-filling water feeder with large capacity for continuous hydration.',
                'image': '💧',
                'category': 'Equipment & Tools',
            },
            {
                'name': 'Hen Care Kit',
                'price': '₹35',
                'description': 'Complete care bundle: supplements, treats, and health essentials.',
                'image': '🐔',
                'category': 'Health & Care',
            },
            {
                'name': 'Metal Drinker & Feeder',
                'price': '₹28',
                'description': 'Heavy-duty galvanized metal feeders and drinkers for durability.',
                'image': '🍽️',
                'category': 'Equipment & Tools',
            },
            {
                'name': 'Herbal Supplement Mix',
                'price': '₹18',
                'description': 'Natural herbs to boost immunity and improve egg quality.',
                'image': '🌿',
                'category': 'Health & Care',
            },
            {
                'name': 'Chicken Treats',
                'price': '₹14',
                'description': 'Mixed grains and seeds for healthy snacks and enrichment.',
                'image': '🌽',
                'category': 'Feed & Nutrition',
            },
            {
                'name': 'Nesting Box Bedding',
                'price': '₹22',
                'description': 'Soft wood shavings and straw for comfortable laying boxes.',
                'image': '📦',
                'category': 'Housing & Shelter',
            },
            {
                'name': 'Safe Pest Control',
                'price': '₹32',
                'description': 'Organic insect repellent for coop hygiene and protection.',
                'image': '🐛',
                'category': 'Health & Care',
            },
            {
                'name': 'Temperature Monitor',
                'price': '₹35',
                'description': 'Digital thermometer to maintain optimal coop temperature.',
                'image': '🌡️',
                'category': 'Equipment & Tools',
            },
            {
                'name': 'Portable Chicken Run',
                'price': '₹95',
                'description': 'Mobile enclosure for supervised outdoor foraging and exercise.',
                'image': '⛺',
                'category': 'Housing & Shelter',
            },
        ]

        for product_data in products_data:
            Product.objects.get_or_create(
                name=product_data['name'],
                defaults=product_data
            )

        self.stdout.write(
            self.style.SUCCESS('Successfully populated the database with products')
        )
