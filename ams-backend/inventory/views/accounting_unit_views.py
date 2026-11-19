from rest_framework import viewsets, filters, permissions as drf_permissions

from ..models.accounting_unit_model import AccountingUnit
from ..serializers.accounting_unit_serializer import AccountingUnitSerializer


class AccountingUnitPermission(drf_permissions.BasePermission):
    """Any authenticated user can list/read units; only admins can mutate.

    Non-admin users pick from the list via the item-form dropdown but cannot
    add, rename, or disable entries.
    """

    def has_permission(self, request, view):  # type: ignore[override]
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if request.method in drf_permissions.SAFE_METHODS:
            return True
        return bool(user.is_superuser)


class AccountingUnitViewSet(viewsets.ModelViewSet):
    """CRUD for the canonical accounting-unit list.

    Writes are superuser-only. Reads are available to any authenticated user
    so the item form can populate its dropdown.
    """
    serializer_class = AccountingUnitSerializer
    permission_classes = [AccountingUnitPermission]
    filter_backends = [filters.SearchFilter]
    search_fields = ['code', 'name']

    def get_queryset(self):
        qs = AccountingUnit.objects.all().order_by('code')
        if self.request.query_params.get('active_only', '').lower() in ('1', 'true', 'yes'):
            qs = qs.filter(is_active=True)
        return qs
