import os
import tempfile
from pathlib import Path
from unittest.mock import patch

from django.core.files.base import ContentFile
from django.test import SimpleTestCase, override_settings

from Kukuta.storage import OptionalCloudinaryStorage


class OptionalCloudinaryStorageTests(SimpleTestCase):
    def test_uses_local_storage_without_cloudinary_configuration(self):
        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(CLOUDINARY_URL='', MEDIA_ROOT=Path(media_root)):
                storage = OptionalCloudinaryStorage()
                name = storage.save('products/test.txt', ContentFile(b'test data'))

                self.assertEqual(name, 'products/test.txt')
                self.assertTrue(storage.exists(name))
                self.assertEqual(storage.url(name), '/media/products/test.txt')
                with storage.open(name) as uploaded_file:
                    self.assertEqual(uploaded_file.read(), b'test data')

                storage.delete(name)
                self.assertFalse(storage.exists(name))

    def test_routes_cloudinary_image_uploads_to_image_resource_type(self):
        cloudinary_url = 'cloudinary://123456:check-only-secret@demo'
        with override_settings(CLOUDINARY_URL=cloudinary_url):
            with patch.dict(os.environ, {'CLOUDINARY_URL': cloudinary_url}):
                with patch(
                    'cloudinary.uploader.upload',
                    return_value={'public_id': 'products/images/test'},
                ) as upload:
                    name = OptionalCloudinaryStorage('image').save(
                        'products/images/test.jpg',
                        ContentFile(b'image data'),
                    )

        self.assertEqual(name, 'products/images/test')
        self.assertEqual(upload.call_args.kwargs['resource_type'], 'image')
