"""Backfill Item.tracking_type from the item's category.

After 0069 adds the nullable column, this one copies category.tracking_type
onto every existing item so downstream reads (signals, services, hybrid search)
see the same value the category used to carry. Reverse is a no-op — nulling
the column would silently rely on the category fallback, which is fine.
"""
from django.db import migrations


def backfill_from_category(apps, schema_editor):
    Item = apps.get_model('inventory', 'Item')
    db = schema_editor.connection.alias

    # Pull id + category.tracking_type pairs for items missing their own value.
    rows = (
        Item.objects.using(db)
        .filter(tracking_type__isnull=True)
        .select_related('category')
        .only('id', 'tracking_type', 'category__tracking_type')
    )
    to_update = []
    for item in rows:
        cat_value = getattr(item.category, 'tracking_type', None) if item.category_id else None
        if cat_value:
            item.tracking_type = cat_value
            to_update.append(item)

    if to_update:
        # Batch for large inventories; bulk_update is fast enough.
        Item.objects.using(db).bulk_update(to_update, ['tracking_type'], batch_size=500)


def unbackfill(apps, schema_editor):
    # No-op. Item.get_tracking_type() still falls back to the category, so
    # nulling the column would be a semantically equivalent inverse.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0069_item_tracking_type'),
    ]

    operations = [
        migrations.RunPython(backfill_from_category, unbackfill),
    ]
