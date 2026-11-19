"""Seed a broad default category tree so fresh installs are immediately usable.

Covers the common asset/consumable/perishable surface an organisation hits on
day one: computing, networking, furniture, AV, vehicles, machinery, lab,
appliances, buildings, security, medical, and the usual office/pantry/safety
consumables and perishables.

Idempotent via ``get_or_create`` on (name, parent_category); reverse is a no-op
because deletes would cascade into user-created items and stock. Codes use a
``CAT-SEED-####`` / ``SUB-SEED-####`` namespace to avoid colliding with the
runtime ``CAT-####`` sequence the model's save() generates.
"""
from decimal import Decimal

from django.db import migrations


FIXED_ASSET = 'FIXED_ASSET'
CONSUMABLE = 'CONSUMABLE'
PERISHABLE = 'PERISHABLE'
INDIVIDUAL = 'INDIVIDUAL'
QUANTITY = 'QUANTITY'


# Format: (parent_name, category_type, depreciation_rate_or_None, [(child_name, tracking_type), ...])
SEED_CATEGORIES = [
    # ---------------- FIXED ASSETS ----------------
    ("Computing Equipment", FIXED_ASSET, "33.33", [
        ("Laptops", INDIVIDUAL),
        ("Desktops", INDIVIDUAL),
        ("Monitors", INDIVIDUAL),
        ("Servers", INDIVIDUAL),
        ("Workstations", INDIVIDUAL),
        ("Tablets", INDIVIDUAL),
        ("Computer Peripherals", QUANTITY),
    ]),
    ("Networking Equipment", FIXED_ASSET, "33.33", [
        ("Routers", INDIVIDUAL),
        ("Switches", INDIVIDUAL),
        ("Access Points", INDIVIDUAL),
        ("Firewalls", INDIVIDUAL),
        ("Network Cabling", QUANTITY),
    ]),
    ("Office Furniture", FIXED_ASSET, "10.00", [
        ("Desks", INDIVIDUAL),
        ("Office Chairs", INDIVIDUAL),
        ("Filing Cabinets", INDIVIDUAL),
        ("Conference Tables", INDIVIDUAL),
        ("Bookshelves", INDIVIDUAL),
        ("Lockers", QUANTITY),
    ]),
    ("Audio Visual Equipment", FIXED_ASSET, "20.00", [
        ("Projectors", INDIVIDUAL),
        ("Smart TVs", INDIVIDUAL),
        ("Speakers", INDIVIDUAL),
        ("Microphones", INDIVIDUAL),
        ("Cameras", INDIVIDUAL),
        ("AV Cables & Accessories", QUANTITY),
    ]),
    ("Vehicles", FIXED_ASSET, "20.00", [
        ("Cars", INDIVIDUAL),
        ("Motorcycles", INDIVIDUAL),
        ("Vans", INDIVIDUAL),
        ("Trucks", INDIVIDUAL),
        ("Forklifts", INDIVIDUAL),
    ]),
    ("Heavy Machinery", FIXED_ASSET, "15.00", [
        ("Generators", INDIVIDUAL),
        ("Air Compressors", INDIVIDUAL),
        ("Welding Machines", INDIVIDUAL),
        ("Industrial Pumps", INDIVIDUAL),
    ]),
    ("Hand & Power Tools", FIXED_ASSET, "25.00", [
        ("Drills", INDIVIDUAL),
        ("Grinders", INDIVIDUAL),
        ("Saws", INDIVIDUAL),
        ("Tool Sets", QUANTITY),
    ]),
    ("Laboratory Equipment", FIXED_ASSET, "15.00", [
        ("Microscopes", INDIVIDUAL),
        ("Centrifuges", INDIVIDUAL),
        ("Analytical Instruments", INDIVIDUAL),
        ("Lab Glassware", QUANTITY),
    ]),
    ("Kitchen & Pantry Appliances", FIXED_ASSET, "15.00", [
        ("Refrigerators", INDIVIDUAL),
        ("Microwaves", INDIVIDUAL),
        ("Water Dispensers", INDIVIDUAL),
        ("Coffee Machines", INDIVIDUAL),
    ]),
    ("HVAC & Electrical Systems", FIXED_ASSET, "10.00", [
        ("Air Conditioners", INDIVIDUAL),
        ("UPS Units", INDIVIDUAL),
        ("Fans & Heaters", QUANTITY),
    ]),
    ("Buildings & Structures", FIXED_ASSET, "5.00", [
        ("Office Buildings", INDIVIDUAL),
        ("Warehouses", INDIVIDUAL),
        ("Portable Cabins", INDIVIDUAL),
    ]),
    ("Security & Surveillance", FIXED_ASSET, "20.00", [
        ("CCTV Cameras", INDIVIDUAL),
        ("Access Control Systems", INDIVIDUAL),
        ("Metal Detectors", INDIVIDUAL),
        ("Alarm Systems", INDIVIDUAL),
    ]),
    ("Medical Equipment", FIXED_ASSET, "15.00", [
        ("Diagnostic Devices", INDIVIDUAL),
        ("First Aid Stations", INDIVIDUAL),
        ("Medical Furniture", QUANTITY),
    ]),
    ("Workshop Equipment", FIXED_ASSET, "15.00", [
        ("Lathes", INDIVIDUAL),
        ("Milling Machines", INDIVIDUAL),
        ("Workbenches", QUANTITY),
    ]),

    # ---------------- CONSUMABLES ----------------
    ("Office Stationery", CONSUMABLE, None, [
        ("General Stationery", QUANTITY),
        ("Executive Stationery", QUANTITY),
    ]),
    ("IT Consumables", CONSUMABLE, None, [
        ("Cables & Adapters", QUANTITY),
        ("Toners & Cartridges", QUANTITY),
        ("Storage Media", QUANTITY),
        ("Input Peripherals", QUANTITY),
    ]),
    ("Printing Supplies", CONSUMABLE, None, [
        ("Paper & Envelopes", QUANTITY),
        ("Ink & Toner", QUANTITY),
    ]),
    ("Cleaning Supplies", CONSUMABLE, None, [
        ("General Cleaning", QUANTITY),
        ("Restroom Supplies", QUANTITY),
    ]),
    ("Safety & PPE", CONSUMABLE, None, [
        ("Protective Gear", QUANTITY),
        ("First Aid Consumables", QUANTITY),
    ]),
    ("Pantry Stock", CONSUMABLE, None, [
        ("Beverages", QUANTITY),
        ("Snacks", QUANTITY),
        ("Disposable Utensils", QUANTITY),
    ]),
    ("Electrical Supplies", CONSUMABLE, None, [
        ("Wiring & Connectors", QUANTITY),
        ("Bulbs & Fixtures", QUANTITY),
        ("Batteries", QUANTITY),
    ]),
    ("Plumbing Supplies", CONSUMABLE, None, [
        ("Pipes & Fittings", QUANTITY),
        ("Plumbing Fixtures", QUANTITY),
    ]),

    # ---------------- PERISHABLES ----------------
    ("Chemicals & Reagents", PERISHABLE, None, [
        ("Lab Chemicals", QUANTITY),
        ("Industrial Chemicals", QUANTITY),
    ]),
    ("Medical Supplies", PERISHABLE, None, [
        ("Medications", QUANTITY),
        ("Diagnostic Reagents", QUANTITY),
    ]),
    ("Food & Beverages", PERISHABLE, None, [
        ("Fresh Items", QUANTITY),
        ("Packaged Items", QUANTITY),
    ]),
]


def seed_categories(apps, schema_editor):
    Category = apps.get_model('inventory', 'Category')
    db = schema_editor.connection.alias

    seq = 1
    for parent_name, cat_type, dep_rate, children in SEED_CATEGORIES:
        parent, _created = Category.objects.using(db).get_or_create(
            name=parent_name,
            parent_category=None,
            defaults={
                'code': f'CAT-SEED-{seq:04d}',
                'category_type': cat_type,
                'default_depreciation_rate': Decimal(dep_rate) if dep_rate else None,
                'is_active': True,
            },
        )
        seq += 1
        for child_name, tracking in children:
            Category.objects.using(db).get_or_create(
                name=child_name,
                parent_category=parent,
                defaults={
                    'code': f'SUB-SEED-{seq:04d}',
                    'tracking_type': tracking,
                    'is_active': True,
                },
            )
            seq += 1


def unseed_categories(apps, schema_editor):
    # Intentional no-op: once seeded categories have items, stock entries, and
    # history attached, reverting would cascade and destroy user data.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0065_clean_emdash_user_data'),
    ]

    operations = [
        migrations.RunPython(seed_categories, unseed_categories),
    ]
