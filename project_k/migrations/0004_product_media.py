# Generated manually for multiple images and videos support

import django.db.models.deletion
from django.db import migrations, models


def preserve_legacy_product_images(apps, schema_editor):
    Product = apps.get_model('project_k', 'Product')
    ProductImage = apps.get_model('project_k', 'ProductImage')
    database = schema_editor.connection.alias
    legacy_products = Product.objects.using(database).exclude(image__isnull=True).exclude(image='')

    batch = []
    for product in legacy_products.iterator(chunk_size=500):
        batch.append(ProductImage(
            product_id=product.pk,
            alt_text=product.image,
            is_primary=True,
            order=0,
        ))
        if len(batch) == 500:
            ProductImage.objects.using(database).bulk_create(batch)
            batch = []
    if batch:
        ProductImage.objects.using(database).bulk_create(batch)


class Migration(migrations.Migration):

    dependencies = [
        ('project_k', '0003_alter_product_options_alter_userprofile_options_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProductImage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('image', models.ImageField(blank=True, null=True, upload_to='products/images/')),
                ('image_url', models.URLField(blank=True, null=True)),
                ('alt_text', models.CharField(blank=True, max_length=200, null=True)),
                ('is_primary', models.BooleanField(default=False)),
                ('order', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='images', to='project_k.product')),
            ],
            options={
                'ordering': ['order', 'created_at'],
            },
        ),
        migrations.CreateModel(
            name='ProductVideo',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('video', models.FileField(blank=True, null=True, upload_to='products/videos/')),
                ('video_url', models.URLField(blank=True, null=True)),
                ('title', models.CharField(blank=True, max_length=200, null=True)),
                ('description', models.TextField(blank=True, null=True)),
                ('order', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='videos', to='project_k.product')),
            ],
            options={
                'ordering': ['order', 'created_at'],
            },
        ),
        migrations.RunPython(preserve_legacy_product_images, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='product',
            name='image',
        ),
    ]