# pyright: reportAttributeAccessIssue=false
from rest_framework import viewsets, permissions, filters
from ..models.vendor_model import Vendor
from ..serializers.vendor_serializer import VendorSerializer


class VendorViewSet(viewsets.ModelViewSet):
    """
    Vendors are external suppliers / parties that sit entirely outside the
    university location hierarchy. They are the canonical source for RECEIPT
    stock entries that bring brand-new inventory in from the outside world.
    """
    serializer_class = VendorSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'code', 'contact_person', 'phone', 'email']

    def get_queryset(self):
        return Vendor.objects.all().order_by('name')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
