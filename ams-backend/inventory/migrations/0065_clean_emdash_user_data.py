from django.db import migrations
from django.db.models import F, Value
from django.db.models.functions import Replace


EMDASH = "—"
REPLACEMENT = " - "

TARGETS = [
    ("Item", ["name", "description", "specifications", "acct_unit"]),
    ("Vendor", ["name", "contact_person", "address", "notes"]),
    ("Category", ["name", "notes"]),
    ("Location", ["name", "description", "address", "in_charge"]),
    ("LocationTag", ["name"]),
    ("Person", ["name", "designation", "department"]),
    ("ItemBatch", ["batch_number"]),
    ("ItemInstance", ["serial_number"]),
    ("StockRegister", ["register_number", "closed_reason", "reopened_reason"]),
    ("StockEntry", ["remarks", "purpose", "cancellation_reason", "void_reason"]),
    ("StockAllocation", ["remarks"]),
    ("MovementHistory", ["remarks"]),
    ("StockCorrectionRequest", ["reason", "message", "rejection_reason"]),
    ("StockReconciliationRun", ["reason"]),
    ("StockReconciliationFinding", ["message"]),
    ("InspectionCertificate", [
        "contract_no", "contractor_name", "contractor_address",
        "indenter", "remarks", "inspected_by",
        "consignee_name", "consignee_designation",
        "revision_requested_reason", "rejection_reason",
    ]),
    ("InspectionItem", [
        "item_description", "item_specifications", "remarks",
        "stock_register_no", "central_register_no",
    ]),
    ("InspectionDocument", ["label"]),
    ("MaintenancePlan", ["name", "meter_name", "condition_basis", "checklist"]),
    ("MaintenanceWorkOrder", [
        "title", "description", "vendor_name",
        "failure_mode", "root_cause",
        "condition_before", "condition_after",
        "action_taken", "outcome_notes", "cancellation_reason",
    ]),
    ("MaintenanceLog", [
        "notes", "condition_before", "condition_after",
        "failure_mode", "root_cause", "action_taken",
    ]),
    ("MaintenanceMeterReading", ["reading_name", "unit", "notes"]),
    ("DepreciationPolicy", ["name"]),
    ("DepreciationAssetClass", ["name", "description"]),
    ("FixedAssetRegisterEntry", ["asset_number", "source_reference", "notes"]),
    ("DepreciationRun", ["notes"]),
    ("AssetValueAdjustment", ["reason"]),
]


def clean_emdashes(apps, schema_editor):
    for model_name, fields in TARGETS:
        try:
            Model = apps.get_model("inventory", model_name)
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
        ("inventory", "0064_vendor_stockentry_vendor_and_more"),
    ]

    operations = [
        migrations.RunPython(clean_emdashes, noop_reverse),
    ]
