"""Seed the canonical accounting-unit list surfaced by the item-form dropdown.

Idempotent via ``get_or_create`` on ``code``; reverse is a no-op so we don't
clobber units referenced by live item records.
"""
from django.db import migrations


SEED_UNITS = [
    # (code, name)
    ("pcs", "Pieces"),
    ("Nos", "Numbers"),
    ("Units", "Units"),
    ("Set", "Set"),
    ("Pair", "Pair"),
    ("Dozen", "Dozen"),
    ("Pack", "Pack"),
    ("Box", "Box"),
    ("Carton", "Carton"),
    ("Bag", "Bag"),
    ("Bottle", "Bottle"),
    ("Roll", "Roll"),
    ("Sheet", "Sheet"),
    ("Barrel", "Barrel"),
    ("Drum", "Drum"),
    ("kg", "Kilogram"),
    ("g", "Gram"),
    ("mg", "Milligram"),
    ("ton", "Ton"),
    ("L", "Litre"),
    ("mL", "Millilitre"),
    ("m", "Metre"),
    ("cm", "Centimetre"),
    ("mm", "Millimetre"),
    ("km", "Kilometre"),
    ("ft", "Foot"),
    ("in", "Inch"),
    ("sqm", "Square Metre"),
    ("sqft", "Square Foot"),
    ("cum", "Cubic Metre"),
    ("hour", "Hour"),
    ("day", "Day"),
    ("month", "Month"),
    ("year", "Year"),
    ("license", "License"),
    ("seat", "Seat"),
    ("ream", "Ream"),
    ("bundle", "Bundle"),
    ("coil", "Coil"),
]


def seed_units(apps, schema_editor):
    AccountingUnit = apps.get_model('inventory', 'AccountingUnit')
    db = schema_editor.connection.alias
    for code, name in SEED_UNITS:
        AccountingUnit.objects.using(db).get_or_create(
            code=code,
            defaults={'name': name, 'is_active': True},
        )


def unseed_units(apps, schema_editor):
    # No-op: live items may reference these units by code; dropping them
    # would orphan historical acct_unit strings on Item rows.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0067_accounting_unit'),
    ]

    operations = [
        migrations.RunPython(seed_units, unseed_units),
    ]
