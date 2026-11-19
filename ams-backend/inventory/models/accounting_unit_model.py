from django.db import models


class AccountingUnit(models.Model):
    """Canonical list of accounting/measurement units selectable on items.

    The Item model continues to store the unit as a free-form ``acct_unit``
    string so historical records are untouched; new item create/edit flows
    pick from this list via the dropdown. Only admins can add new rows
    (enforced by ``AccountingUnitPermission``).
    """
    code = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=128)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['code']
        permissions = [
            ('view_accounting_units', 'Can view accounting units'),
        ]

    def __str__(self):
        return f"{self.code} ({self.name})"
