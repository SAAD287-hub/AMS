from django.db.models import Max, Prefetch, Q
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from ..models.correction_model import StockCorrectionRequest
from ..models.stock_register_model import StockRegister
from ..models.stockentry_model import StockEntry, StockEntryItem
from ..serializers.stock_register_serializer import StockRegisterSerializer
from ..serializers.stockentry_serializer import StockEntrySerializer
from ..permissions import StockRegisterPermission
from ..services.deletion_policy import DeletionBlocked, delete_with_policy
from notifications.services import notify_stock_register_closed, notify_stock_register_reopened


class StockRegisterViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for Stock Registers.
    Scoped to the user's accessible store locations.
    """
    serializer_class = StockRegisterSerializer
    permission_classes = [permissions.IsAuthenticated, StockRegisterPermission]
    filter_backends = [filters.SearchFilter]
    search_fields = ['register_number', 'store__name']

    def get_queryset(self):
        user = self.request.user
        queryset = StockRegister.objects.select_related(
            'store',
            'store__parent_location',
            'store__parent_location__parent_location',
            'store__parent_location__parent_location__parent_location',
            'created_by',
            'closed_by',
        ).annotate(
            _last_page_number=Coalesce(Max('source_items__page_number'), 0),
        ).all()

        # Scope to accessible locations
        if not user.is_superuser and not user.groups.filter(name='System Admin').exists():
            if hasattr(user, 'profile'):
                accessible = user.profile.get_stock_register_scope_locations()
                queryset = queryset.filter(store__in=accessible)
            else:
                queryset = queryset.none()

        # Optional store filter
        store_id = self.request.query_params.get('store')
        if store_id:
            queryset = queryset.filter(store_id=store_id)

        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            delete_with_policy(instance)
        except DeletionBlocked as exc:
            return Response(
                {'detail': 'Delete is blocked by existing dependencies.', 'delete_blockers': exc.blockers},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        register = self.get_object()
        reason = str(request.data.get('reason', '')).strip()
        register.is_active = False
        register.closed_at = timezone.now()
        register.closed_by = request.user
        register.closed_reason = reason
        register.save(update_fields=['is_active', 'closed_at', 'closed_by', 'closed_reason', 'updated_at'])
        notify_stock_register_closed(register, request.user)
        serializer = self.get_serializer(register)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='entries')
    def entries(self, request, pk=None):
        """
        Returns all distinct StockEntry rows whose items reference this
        register on either the source side (items.stock_register) or the
        acknowledgment side (items.ack_stock_register).
        """
        register = self.get_object()  # enforces scope via get_queryset
        correction_requests_qs = StockCorrectionRequest.objects.prefetch_related(
            Prefetch(
                'generated_entries',
                queryset=StockEntry.objects.order_by('id'),
                to_attr='prefetched_generated_entries',
            )
        ).order_by('-requested_at')
        qs = (
            StockEntry.objects
            .filter(
                Q(items__stock_register_id=register.pk)
                | Q(items__ack_stock_register_id=register.pk)
            )
            .distinct()
            .select_related(
                'vendor', 'from_location', 'to_location', 'created_by',
                'issued_to', 'acknowledged_by', 'cancelled_by',
                'reference_entry', 'inspection_certificate',
            )
            .prefetch_related(
                Prefetch(
                    'items',
                    queryset=StockEntryItem.objects.select_related(
                        'item', 'batch', 'stock_register', 'ack_stock_register',
                    ).prefetch_related('instances', 'accepted_instances'),
                ),
                Prefetch(
                    'correction_requests',
                    queryset=correction_requests_qs,
                    to_attr='prefetched_correction_requests',
                ),
                Prefetch(
                    'reference_entry__correction_requests',
                    queryset=correction_requests_qs,
                    to_attr='prefetched_correction_requests',
                ),
                Prefetch(
                    'correction_entries',
                    queryset=StockEntry.objects.order_by('id'),
                    to_attr='prefetched_correction_entries',
                ),
                Prefetch(
                    'correction_entries',
                    queryset=StockEntry.objects.filter(reference_purpose='REPLACEMENT').order_by('-created_at'),
                    to_attr='prefetched_replacement_entries',
                ),
            )
            .order_by('-created_at')
        )
        from .stockentry_views import StockEntryViewSet
        page = self.paginate_queryset(qs)
        if page is not None:
            context = self.get_serializer_context()
            StockEntryViewSet._add_source_inspection_context(self, context, page)
            serializer = StockEntrySerializer(page, many=True, context=context)
            return self.get_paginated_response(serializer.data)
        entries = list(qs)
        context = self.get_serializer_context()
        StockEntryViewSet._add_source_inspection_context(self, context, entries)
        serializer = StockEntrySerializer(entries, many=True, context=context)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        register = self.get_object()
        reason = str(request.data.get('reason', '')).strip()
        register.is_active = True
        register.reopened_at = timezone.now()
        register.reopened_by = request.user
        register.reopened_reason = reason
        register.save(update_fields=['is_active', 'reopened_at', 'reopened_by', 'reopened_reason', 'updated_at'])
        notify_stock_register_reopened(register, request.user)
        serializer = self.get_serializer(register)
        return Response(serializer.data, status=status.HTTP_200_OK)
