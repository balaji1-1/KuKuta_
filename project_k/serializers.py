from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Message, Product, ProductImage, ProductVideo, UserProfile, ProductReview, ProductReviewImage

class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = '__all__'

class ProductVideoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVideo
        fields = '__all__'


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    recipient_name = serializers.SerializerMethodField()
    product_name = serializers.SerializerMethodField()
    product_id = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all(), source='product', write_only=True, required=False, allow_null=True)

    class Meta:
        model = Message
        fields = ['id', 'sender', 'recipient', 'sender_name', 'recipient_name', 'product', 'product_id', 'product_name', 'content', 'created_at', 'is_read']
        read_only_fields = ['id', 'sender', 'created_at', 'is_read']

    def get_sender_name(self, obj):
        return obj.sender.username

    def get_recipient_name(self, obj):
        return obj.recipient.username

    def get_product_name(self, obj):
        return obj.product.name if obj.product else None

    def create(self, validated_data, **kwargs):
        request = self.context.get('request')
        if request and getattr(request, 'user', None):
            validated_data['sender'] = request.user
        recipient = kwargs.get('recipient')
        if recipient is not None:
            validated_data['recipient'] = recipient
        return super().create(validated_data)


class ProductReviewSerializer(serializers.ModelSerializer):
    buyer_name = serializers.CharField(source='buyer.username', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    images = serializers.SerializerMethodField()

    class Meta:
        model = ProductReview
        fields = ['id', 'product', 'product_name', 'buyer', 'buyer_name', 'rating', 'comment', 'images', 'created_at', 'updated_at']
        read_only_fields = ['id', 'buyer', 'buyer_name', 'created_at', 'updated_at']

    def get_images(self, obj):
        request = self.context.get('request')
        return [request.build_absolute_uri(image.image.url) if request else image.image.url for image in obj.images.all()]

    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError('Rating must be between 1 and 5.')
        return value

    def validate_comment(self, value):
        if not value.strip():
            raise serializers.ValidationError('Review comment cannot be empty.')
        return value.strip()


class ProductSerializer(serializers.ModelSerializer):
    images = ProductImageSerializer(many=True, read_only=True)
    videos = ProductVideoSerializer(many=True, read_only=True)
    image = serializers.SerializerMethodField()
    seller_email = serializers.SerializerMethodField()
    seller_phone = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [field.name for field in Product._meta.fields] + ['images', 'videos', 'image', 'seller_email', 'seller_phone']

    def get_image(self, obj):
        first_image = obj.images.first()
        if first_image is None:
            return '🥚'

        if first_image.image_url:
            return first_image.image_url

        if first_image.image:
            request = self.context.get('request')
            try:
                return request.build_absolute_uri(first_image.image.url) if request else first_image.image.url
            except Exception:
                return first_image.image.url

        return '🥚'

    def get_seller_email(self, obj):
        seller_name = obj.seller
        if not seller_name:
            return None
        try:
            user = User.objects.get(username=seller_name)
        except User.DoesNotExist:
            return None
        return user.email

    def get_seller_phone(self, obj):
        seller_name = obj.seller
        if not seller_name:
            return None
        try:
            profile = UserProfile.objects.get(user__username=seller_name)
        except UserProfile.DoesNotExist:
            return None
        return profile.phone

    def validate(self, attrs):
        category = attrs.get('category')
        bird_type = attrs.get('bird_type')

        if category == 'Bird' and not bird_type:
            raise serializers.ValidationError({'bird_type': 'Bird products require a bird type.'})

        return attrs
