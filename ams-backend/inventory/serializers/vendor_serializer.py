from rest_framework import serializers
from ..models.vendor_model import Vendor


class VendorSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    def get_created_by_name(self, obj):
        user = obj.created_by
        if not user:
            return None
        return user.get_full_name() or user.get_username()

    class Meta:
        model = Vendor
        fields = '__all__'
        read_only_fields = ('created_by', 'created_at', 'updated_at')
