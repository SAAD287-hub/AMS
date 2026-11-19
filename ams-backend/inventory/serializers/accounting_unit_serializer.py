from rest_framework import serializers
from ..models.accounting_unit_model import AccountingUnit


class AccountingUnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccountingUnit
        fields = ['id', 'code', 'name', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
