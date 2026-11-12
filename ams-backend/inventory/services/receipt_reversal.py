from ..models.instance_model import InstanceStatus, ItemInstance
from ..models.stock_record_model import StockRecord


def reversal_blockers_for_receipt(entry):
    """
    Return a list of human-readable blocker messages explaining why this
    originating receipt (vendor or inspection-driven, no from_location)
    cannot be safely reversed.
    """
    blockers = []
    if entry.entry_type != 'RECEIPT' or entry.from_location_id is not None:
        blockers.append('Only originating receipts (no source store) can be reversed.')
        return blockers

    to_loc = entry.to_location
    if to_loc is None:
        blockers.append('Receiving store is missing on this entry.')
        return blockers

    for item_entry in entry.items.all():
        instances = list(item_entry.instances.all())
        for inst in instances:
            if inst.status != InstanceStatus.AVAILABLE:
                blockers.append(
                    f'Instance {inst.serial_number or inst.pk} for {item_entry.item.name} '
                    f'is no longer available (status: {inst.status}).'
                )
            elif inst.current_location_id != to_loc.id:
                blockers.append(
                    f'Instance {inst.serial_number or inst.pk} for {item_entry.item.name} '
                    f'has been moved out of {to_loc.name}.'
                )

        if not instances:
            try:
                record = StockRecord.objects.get(item=item_entry.item, location=to_loc, batch=item_entry.batch)
            except StockRecord.DoesNotExist:
                blockers.append(f'No stock record found for {item_entry.item.name} at {to_loc.name}.')
                continue
            available = record.quantity - (record.allocated_quantity or 0) - (record.in_transit_quantity or 0)
            if available < item_entry.quantity:
                blockers.append(
                    f'{item_entry.item.name} has only {available} unallocated units at {to_loc.name}, '
                    f'but {item_entry.quantity} were received on this entry.'
                )

    return blockers


def can_reverse_receipt(entry):
    return not reversal_blockers_for_receipt(entry)


def apply_receipt_reversal(entry):
    """
    Decrement stock, delete auto-created instances for an originating RECEIPT
    entry whose status has just been set to CANCELLED. Idempotent per instance:
    if an instance was already removed, it is skipped.
    """
    to_loc = entry.to_location
    if to_loc is None:
        return

    for item_entry in entry.items.all():
        instances = list(item_entry.instances.all())
        if instances:
            StockRecord.update_balance(item_entry.item, to_loc, quantity_change=-len(instances), batch=item_entry.batch)
            ItemInstance.objects.filter(pk__in=[inst.pk for inst in instances]).delete()
        else:
            StockRecord.update_balance(item_entry.item, to_loc, quantity_change=-item_entry.quantity, batch=item_entry.batch)
