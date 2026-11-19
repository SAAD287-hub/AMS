"""Backfill the three default stock registers (CSR / DSR / FFR) for every
existing department's main store.

A department is a Location with ``is_standalone=True`` AND a non-null parent
(so the root standalone is excluded — its Central Store is not auto-triplicated).
The registers are keyed on ``(store, register_type)`` so legacy hand-created
CSR/DSR rows with custom ``register_number`` values are left untouched.
"""
from django.db import migrations


DEFAULT_CODES = ("CSR", "DSR", "FFR")


def seed_defaults(apps, schema_editor):
    Location = apps.get_model("inventory", "Location")
    StockRegister = apps.get_model("inventory", "StockRegister")
    db = schema_editor.connection.alias

    departments = Location.objects.using(db).filter(
        is_standalone=True,
        parent_location__isnull=False,
    )

    for department in departments:
        store_id = getattr(department, "auto_created_store_id", None)
        if not store_id:
            continue
        try:
            store = Location.objects.using(db).get(pk=store_id)
        except Location.DoesNotExist:
            continue

        for code in DEFAULT_CODES:
            if StockRegister.objects.using(db).filter(store=store, register_type=code).exists():
                continue
            StockRegister.objects.using(db).create(
                store=store,
                register_type=code,
                register_number=f"{code}-{department.code}-0001",
                is_active=True,
                created_by=None,
            )


def unseed(apps, schema_editor):
    # No-op: historical registers may now carry StockEntry/MovementHistory
    # rows referencing them; reversing this migration would orphan data.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0071_stockregister_add_ffr"),
    ]

    operations = [
        migrations.RunPython(seed_defaults, unseed),
    ]
