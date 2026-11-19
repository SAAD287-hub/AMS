// Central source of user-facing labels for stock entries.
//
// Backend codes (ISSUE / RECEIPT / RETURN, reference_purpose enum values) are
// stable wire-protocol strings — this file translates them into plain English
// a storekeeper or clerk can read without training. Nothing else in the
// frontend should hardcode "Receipt" / "Issue" / "Return" / "Allocation" for a
// stock entry; pass the row through formatStockEntryKind instead.

export type EntryType = "ISSUE" | "RECEIPT" | "RETURN";

export const ENTRY_DIRECTION_LABEL: Record<EntryType, string> = {
  ISSUE: "Stock Out",
  RECEIPT: "Stock In",
  RETURN: "Rejection Return (automatic)",
};

export const ENTRY_DIRECTION_TOOLTIP: Record<EntryType, string> = {
  ISSUE:
    "Items leaving a store — a transfer to another store, an issue to an employee, or a dispatch to a department.",
  RECEIPT:
    "Items coming into a store — a new delivery from a vendor, or stock returning from an employee or a department.",
  RETURN:
    "Created automatically by the system when a store rejects part of a receipt. You never choose this yourself.",
};

// Minimal shape needed to classify an entry. Any row from the list, detail,
// notification payload, dashboard activity feed etc. can be narrowed to this.
export interface StockEntryKindInput {
  entry_type: EntryType;
  reference_purpose?: string | null;
  // Optional target shape hints (present on create form / detail payloads).
  issue_target?: "STORE" | "PERSON" | "LOCATION" | null;
  return_source?: "PERSON" | "LOCATION" | null;
  vendor?: number | string | null;
  issued_to?: number | string | null;
  from_location?: number | string | null;
  to_location?: number | string | null;
}

export type StockEntryKind =
  | "Store Transfer"
  | "Issue to Employee"
  | "Issue to Department"
  | "Vendor Delivery"
  | "Return from Employee"
  | "Return from Department"
  | "Transfer Receipt"
  | "Rejection Return (automatic)"
  | "Correction entry";

const CORRECTION_PURPOSES = new Set([
  "REVERSAL",
  "ADDITIONAL_MOVEMENT",
  "REPLACEMENT",
  "ADJUSTMENT",
]);

export function formatStockEntryKind(entry: StockEntryKindInput): StockEntryKind {
  const refPurpose = (entry.reference_purpose ?? "").toUpperCase();

  // RETURN is always the auto-rejection return — users cannot create it.
  if (entry.entry_type === "RETURN") return "Rejection Return (automatic)";

  // Correction-family entries (any direction) carry a reference_purpose that
  // marks them as follow-ups to another entry.
  if (CORRECTION_PURPOSES.has(refPurpose)) return "Correction entry";

  if (entry.entry_type === "RECEIPT") {
    // Auto-paired receipt generated when the destination store acknowledges a transfer.
    if (refPurpose === "AUTO_RECEIPT") return "Transfer Receipt";

    // Vendor delivery: vendor id set, OR explicit return_source === LOCATION with vendor attached.
    if (entry.vendor != null && entry.vendor !== "") return "Vendor Delivery";

    if (entry.return_source === "PERSON" || entry.issued_to != null) return "Return from Employee";
    // Fallback: anything else incoming is a department return.
    return "Return from Department";
  }

  // ISSUE branch.
  if (entry.issue_target === "STORE") return "Store Transfer";
  if (entry.issue_target === "PERSON" || entry.issued_to != null) return "Issue to Employee";
  if (entry.issue_target === "LOCATION") return "Issue to Department";

  // If we only have from/to location ids (no explicit target field), the safest
  // default is a Store Transfer — the detail page will still render fine.
  return "Store Transfer";
}

// Inline verb for prose like "Vendor Delivery · received on 2026-11-18" or
// "Issue to Employee · issued to Ali Khan".
export function formatStockEntryVerb(entry: StockEntryKindInput): "issued" | "received" | "returned" | "delivered" {
  const kind = formatStockEntryKind(entry);
  switch (kind) {
    case "Vendor Delivery":
      return "delivered";
    case "Return from Employee":
    case "Return from Department":
    case "Rejection Return (automatic)":
      return "returned";
    case "Transfer Receipt":
      return "received";
    default:
      return "issued";
  }
}

// Short "Stock In" / "Stock Out" direction phrase — for top-level picker or chip.
export function formatStockEntryDirection(entry: StockEntryKindInput): string {
  return ENTRY_DIRECTION_LABEL[entry.entry_type];
}

// Related-entry chip labels for the detail page. The current entry is the one
// the user is viewing; the "other" entry describes the relationship.
export type RelatedEntryRelation =
  | "receiving-side-of-transfer"
  | "auto-return-for-rejection"
  | "correction-of"
  | "original-of-correction"
  | "reference";

export const RELATED_ENTRY_LABEL: Record<RelatedEntryRelation, string> = {
  "receiving-side-of-transfer": "Receiving side of this transfer",
  "auto-return-for-rejection": "Auto-return for rejected items",
  "correction-of": "Correction entry",
  "original-of-correction": "Original entry",
  reference: "Related entry",
};

// Classify a related-entry chip from a (current, related) pair. Falls back to
// the generic "Related entry" label when the relationship isn't recognised.
export function classifyRelatedEntry(
  current: StockEntryKindInput,
  related: StockEntryKindInput,
): RelatedEntryRelation {
  const currentPurpose = (current.reference_purpose ?? "").toUpperCase();
  const relatedPurpose = (related.reference_purpose ?? "").toUpperCase();

  if (relatedPurpose === "AUTO_RECEIPT") return "receiving-side-of-transfer";
  if (relatedPurpose === "REJECTION_RETURN" || related.entry_type === "RETURN") {
    return "auto-return-for-rejection";
  }
  if (CORRECTION_PURPOSES.has(relatedPurpose)) return "correction-of";
  if (CORRECTION_PURPOSES.has(currentPurpose)) return "original-of-correction";
  return "reference";
}
