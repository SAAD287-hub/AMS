from django.db import migrations
from django.db.models import F, Value
from django.db.models.functions import Replace


EMDASH = "—"
REPLACEMENT = " - "

TARGETS = [
    ("NotificationEvent", ["title", "message", "href"]),
]


def clean_emdashes(apps, schema_editor):
    for model_name, fields in TARGETS:
        try:
            Model = apps.get_model("notifications", model_name)
        except LookupError:
            continue
        for field in fields:
            if not any(f.name == field for f in Model._meta.get_fields()):
                continue
            Model.objects.filter(**{f"{field}__contains": EMDASH}).update(
                **{field: Replace(F(field), Value(EMDASH), Value(REPLACEMENT))}
            )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(clean_emdashes, noop_reverse),
    ]
