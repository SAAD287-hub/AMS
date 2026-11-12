"""Backfill ``UserProfile.employee_id`` for every row missing one.

Rules:
- Assigns ``EMP-XXXX`` ids (zero-padded, 4 digits) in ascending user-id order
  so the sequence is deterministic and re-runs produce the same mapping.
- Seeds the counter from the highest existing ``EMP-####`` id, so this is safe
  to re-run and will not reuse numbers already issued by the model's
  ``save()`` auto-generator.
- Manually-assigned non-sequence ids (e.g. ``FAC-2021-07``) are left alone
  and do not influence numbering.
- Reverse is intentionally a no-op: once an employee id is operationally
  visible we do not strip it on migration rollback.
"""
from __future__ import annotations

import re

from django.db import migrations, models

_EMPLOYEE_ID_PATTERN = re.compile(r"^EMP-(\d+)$")


def backfill_employee_ids(apps, schema_editor):
    UserProfile = apps.get_model("user_management", "UserProfile")

    # 1. Seed counter from existing EMP-#### ids so we never collide with
    #    an already-issued number.
    max_n = 0
    existing_ids = (
        UserProfile.objects
        .exclude(employee_id__isnull=True)
        .exclude(employee_id__exact="")
        .values_list("employee_id", flat=True)
    )
    for eid in existing_ids:
        match = _EMPLOYEE_ID_PATTERN.match(eid or "")
        if match:
            n = int(match.group(1))
            if n > max_n:
                max_n = n

    # 2. Backfill rows with NULL or empty employee_id in deterministic order.
    #    Order by the owning user's pk so the mapping is stable across re-runs
    #    and across environments that share user ids.
    missing_qs = (
        UserProfile.objects
        .filter(models.Q(employee_id__isnull=True) | models.Q(employee_id__exact=""))
        .order_by("user_id")
    )

    for profile in missing_qs:
        max_n += 1
        profile.employee_id = f"EMP-{max_n:04d}"
        profile.save(update_fields=["employee_id"])


def noop_reverse(apps, schema_editor):
    """Reverse is intentionally a no-op.

    Reversing would strip legitimate operational ids from live rows, which
    is a far worse outcome than leaving the ids in place when rolling back
    this migration.
    """
    return None


class Migration(migrations.Migration):

    dependencies = [
        ("user_management", "0010_voiceusage"),
    ]

    operations = [
        migrations.RunPython(backfill_employee_ids, noop_reverse),
    ]
