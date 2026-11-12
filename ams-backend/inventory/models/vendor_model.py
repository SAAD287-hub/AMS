from django.db import models
from django.conf import settings


class Vendor(models.Model):
    """
    External party that supplies stock. Vendors are intentionally kept
    outside the location hierarchy: they do not live under the university
    root and are not organizational units. Stock entries that bring new
    inventory in from the outside world reference a Vendor directly.
    """

    name = models.CharField(max_length=255, unique=True)
    code = models.CharField(max_length=32, unique=True, blank=True, db_index=True)
    contact_person = models.CharField(max_length=255, blank=True, default='')
    phone = models.CharField(max_length=32, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    address = models.TextField(blank=True, default='')
    tax_number = models.CharField(max_length=64, blank=True, default='',
        help_text="NTN / tax / registration number if applicable.")
    notes = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='vendors_created',
    )

    class Meta:
        ordering = ['name']
        indexes = [models.Index(fields=['is_active'])]

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = self._generate_code()
        super().save(*args, **kwargs)

    def _generate_code(self) -> str:
        last = Vendor.objects.order_by('-id').first()
        next_seq = (last.id + 1) if last else 1
        while True:
            candidate = f"VEND-{next_seq:04d}"
            if not Vendor.objects.filter(code=candidate).exists():
                return candidate
            next_seq += 1
