import type { LocationRecord, StockRegisterRecord } from "@/lib/userUiShared";

export function filterStockRegisters(
  registers: StockRegisterRecord[],
  {
    search,
    typeFilter,
    statusFilter,
  }: {
    search: string;
    typeFilter: string;
    statusFilter: string;
  },
) {
  const q = search.trim().toLowerCase();

  return registers.filter((register) => {
    if (q) {
      const hay = `${register.register_number} ${register.register_type} ${register.store_name ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    if (typeFilter !== "all" && register.register_type !== typeFilter) return false;
    if (statusFilter === "active" && !register.is_active) return false;
    if (statusFilter === "inactive" && register.is_active) return false;
    return true;
  });
}

export function getActiveStoreOptions(locations: LocationRecord[]) {
  // Stock registers live at stores only, not at arbitrary departments or labs.
  return locations
    .filter((location) => location.is_active && location.is_store)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getCreatableStockRegisterStoreOptions(
  locations: LocationRecord[],
  assignedLocationIds: number[] | null | undefined,
) {
  const activeStores = getActiveStoreOptions(locations);
  if (!assignedLocationIds?.length) return activeStores;

  const assignedIds = new Set(assignedLocationIds.map(Number));
  return activeStores.filter(location => assignedIds.has(location.id));
}
