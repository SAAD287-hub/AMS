from django.db import models
from rest_framework import serializers
from ..models.stock_register_model import StockRegister
from ..models.stockentry_model import StockEntryItem
from ..models.location_model import Location
from ..services.deletion_policy import get_delete_blockers


class StockRegisterSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    closed_by_name = serializers.CharField(source='closed_by.username', read_only=True)
    reopened_by_name = serializers.CharField(source='reopened_by.username', read_only=True)
    can_delete = serializers.SerializerMethodField()
    delete_blockers = serializers.SerializerMethodField()
    last_page_number = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()

    def get_delete_blockers(self, obj):
        return get_delete_blockers(obj)

    def get_can_delete(self, obj):
        return not self.get_delete_blockers(obj)

    def get_last_page_number(self, obj):
        annotated = getattr(obj, '_last_page_number', None)
        if annotated is not None:
            return annotated or 0
        agg = StockEntryItem.objects.filter(stock_register=obj).aggregate(mx=models.Max('page_number'))
        return agg['mx'] or 0

    def get_department(self, obj):
        if not obj.store:
            return None
        standalone = obj.store.get_parent_standalone()
        if not standalone:
            return None
        return {'id': standalone.id, 'name': standalone.name}

    def validate(self, attrs):
        register_number = attrs.get('register_number') or getattr(self.instance, 'register_number', None)
        store = attrs.get('store') or getattr(self.instance, 'store', None)
        if register_number and store:
            qs = StockRegister.objects.filter(register_number__iexact=register_number.strip(), store=store)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({'register_number': f'A register named "{register_number}" already exists for {store.name}.'})
        return attrs

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            self.fields['store'].queryset = Location.objects.none()
            return

        # Allow registers against any active location: departments/labs/rooms
        # can maintain their own register books for receipts they acknowledge,
        # not only top-level stores.
        if request.user.is_superuser:
            self.fields['store'].queryset = Location.objects.filter(is_active=True)
            return

        if not hasattr(request.user, 'profile'):
            self.fields['store'].queryset = Location.objects.none()
            return

        creatable_stores = request.user.profile.get_creatable_stock_register_stores()
        current_store_id = getattr(self.instance, 'store_id', None)
        if current_store_id:
            creatable_stores = Location.objects.filter(
                models.Q(id__in=creatable_stores.values_list('id', flat=True))
                | models.Q(id=current_store_id),
                is_active=True,
            ).distinct()
        self.fields['store'].queryset = creatable_stores.filter(is_active=True)

    class Meta:
        model = StockRegister
        fields = [
            'id', 'register_number', 'register_type', 'store', 'store_name',
            'is_active', 'closed_at', 'closed_by', 'closed_by_name', 'closed_reason',
            'reopened_at', 'reopened_by', 'reopened_by_name', 'reopened_reason',
            'created_at', 'updated_at', 'created_by_name', 'can_delete', 'delete_blockers',
            'last_page_number', 'department',
        ]
        read_only_fields = (
            'created_at', 'updated_at', 'created_by',
            'closed_at', 'closed_by', 'reopened_at', 'reopened_by',
        )
