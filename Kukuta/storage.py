from django.conf import settings
from django.core.files.storage import FileSystemStorage, Storage
from django.utils.deconstruct import deconstructible


@deconstructible
class OptionalCloudinaryStorage(Storage):
    def __init__(self, resource_type='raw'):
        self.resource_type = resource_type

    def _backend(self):
        if not settings.CLOUDINARY_URL:
            return FileSystemStorage(
                location=settings.MEDIA_ROOT,
                base_url=settings.MEDIA_URL,
            )

        from cloudinary_storage.storage import (
            MediaCloudinaryStorage,
            RawMediaCloudinaryStorage,
            VideoMediaCloudinaryStorage,
        )

        storage_classes = {
            'image': MediaCloudinaryStorage,
            'raw': RawMediaCloudinaryStorage,
            'video': VideoMediaCloudinaryStorage,
        }
        try:
            storage_class = storage_classes[self.resource_type]
        except KeyError as error:
            raise ValueError(
                f'Unsupported Cloudinary resource type: {self.resource_type}'
            ) from error
        return storage_class()

    def _open(self, name, mode='rb'):
        return self._backend().open(name, mode)

    def _save(self, name, content):
        return self._backend().save(name, content)

    def delete(self, name):
        return self._backend().delete(name)

    def exists(self, name):
        return self._backend().exists(name)

    def listdir(self, path):
        return self._backend().listdir(path)

    def size(self, name):
        return self._backend().size(name)

    def url(self, name):
        return self._backend().url(name)

    def path(self, name):
        return self._backend().path(name)

    def get_available_name(self, name, max_length=None):
        return self._backend().get_available_name(name, max_length)

    def generate_filename(self, filename):
        return self._backend().generate_filename(filename)
