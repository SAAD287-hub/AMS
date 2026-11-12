"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import { fetchAllPages } from "@/lib/stockEntryData";
import { useCapabilities, useCan } from "@/contexts/CapabilitiesContext";

interface LocationRow {
  id: number;
  name: string;
  code: string;
  location_type: string;
  is_store: boolean;
  is_active: boolean;
  parent_location: number | null;
  parent_location_name?: string | null;
  full_path?: string | null;
}

interface StockRow {
  id: number;
  item: number;
  item_name: string;
  location: number;
  quantity: number;
  in_transit_quantity: number;
  available_quantity: number;
  low_stock_threshold: number;
}

interface StoreCardData {
  location: LocationRow;
  itemCount: number;
  totalUnits: number;
  availableUnits: number;
  lowStockCount: number;
  inTransitUnits: number;
}

export default function StoresPage() {
  const router = useRouter();
  const { isLoading: capsLoading } = useCapabilities();
  const canView = useCan("items");

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [locRes, stockRes] = await Promise.all([
        fetchAllPages<LocationRow>("/api/inventory/locations/?page_size=500"),
        fetchAllPages<StockRow>("/api/inventory/distribution/?page_size=1000"),
      ]);
      setLocations(locRes);
      setStock(stockRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stores");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (capsLoading) return;
    if (!canView) {
      router.replace("/403");
      return;
    }
    void load();
  }, [canView, capsLoading, load, router]);

  const cards = useMemo<StoreCardData[]>(() => {
    const byLocation = new Map<number, StockRow[]>();
    for (const row of stock) {
      const bucket = byLocation.get(row.location) ?? [];
      bucket.push(row);
      byLocation.set(row.location, bucket);
    }

    const stockHoldingIds = new Set<number>([
      ...locations.filter(l => l.is_store).map(l => l.id),
      ...Array.from(byLocation.keys()),
    ]);

    const results: StoreCardData[] = [];
    for (const locId of stockHoldingIds) {
      const location = locations.find(l => l.id === locId);
      if (!location || !location.is_active) continue;
      const rows = byLocation.get(locId) ?? [];
      const uniqueItems = new Set(rows.map(r => r.item));
      let totalUnits = 0, availableUnits = 0, inTransitUnits = 0, lowStockCount = 0;
      for (const row of rows) {
        totalUnits += row.quantity;
        availableUnits += row.available_quantity;
        inTransitUnits += row.in_transit_quantity;
        if (row.available_quantity <= row.low_stock_threshold) lowStockCount += 1;
      }
      results.push({
        location,
        itemCount: uniqueItems.size,
        totalUnits,
        availableUnits,
        inTransitUnits,
        lowStockCount,
      });
    }

    const q = search.trim().toLowerCase();
    const filtered = q
      ? results.filter(c =>
          c.location.name.toLowerCase().includes(q) ||
          c.location.code?.toLowerCase().includes(q) ||
          (c.location.full_path ?? "").toLowerCase().includes(q)
        )
      : results;

    return filtered.sort((a, b) => b.totalUnits - a.totalUnits || a.location.name.localeCompare(b.location.name));
  }, [locations, stock, search]);

  const totals = useMemo(() => {
    return cards.reduce((acc, c) => ({
      stores: acc.stores + 1,
      items: acc.items + c.itemCount,
      units: acc.units + c.totalUnits,
      lowStock: acc.lowStock + c.lowStockCount,
    }), { stores: 0, items: 0, units: 0, lowStock: 0 });
  }, [cards]);

  return (
    <div>
      <Topbar breadcrumb={["Inventory", "Stores"]} />
      <main className="page">
        <div className="page-head">
          <div className="page-title-group">
            <h1>Stores</h1>
          </div>
        </div>

        <div className="stock-entry-help" style={{ margin: "0 0 16px" }}>
          <div className="stock-entry-help-title">Stock per store</div>
          <div className="stock-entry-help-body">
            Browse every stock-holding location and see its live inventory. Pick a store to drill into exactly which items are there, how many units, and which are running low. Totals below are computed across every store you can see.
          </div>
        </div>

        {error && (
          <div style={{ padding: "12px 16px", background: "var(--danger-weak)", border: "1px solid color-mix(in oklch, var(--danger) 30%, transparent)", borderRadius: "var(--radius)", color: "var(--danger)", fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div className="stores-summary">
          <div className="stores-summary-item">
            <div className="stores-summary-label">Stores</div>
            <div className="stores-summary-value">{totals.stores}</div>
          </div>
          <div className="stores-summary-item">
            <div className="stores-summary-label">Distinct items</div>
            <div className="stores-summary-value">{totals.items}</div>
          </div>
          <div className="stores-summary-item">
            <div className="stores-summary-label">Total units</div>
            <div className="stores-summary-value">{totals.units}</div>
          </div>
          <div className="stores-summary-item stores-summary-warn">
            <div className="stores-summary-label">Low-stock lines</div>
            <div className="stores-summary-value">{totals.lowStock}</div>
          </div>
        </div>

        <div className="filter-bar" style={{ marginTop: 16 }}>
          <div className="filter-bar-left">
            <label className="search-input">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
              <input
                placeholder="Search by store name, code, or hierarchy path…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onClick={e => { if (!e.currentTarget.value) e.currentTarget.setSelectionRange(0, 0); }}
                onFocus={e => { if (!e.currentTarget.value) e.currentTarget.setSelectionRange(0, 0); }}
              />
              {search && <button type="button" className="clear-search" onClick={e => { e.preventDefault(); setSearch(""); }}>×</button>}
            </label>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Loading stores…</div>
        ) : cards.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
            {search ? "No stores match your search." : "No stock-holding locations found yet."}
          </div>
        ) : (
          <div className="stores-list">
            <div className="stores-list-head" role="row">
              <div className="stores-list-col-name">Store</div>
              <div className="stores-list-col-stat">Items</div>
              <div className="stores-list-col-stat">Available</div>
              <div className="stores-list-col-stat">In transit</div>
              <div className="stores-list-col-stat">Total</div>
              <div className="stores-list-col-status">Status</div>
              <div className="stores-list-col-arrow" aria-hidden="true" />
            </div>
            {cards.map(card => {
              const isOut = card.totalUnits === 0;
              const isLow = card.lowStockCount > 0;
              return (
                <Link key={card.location.id} href={`/stores/${card.location.id}`} className="stores-list-row" role="row">
                  <div className="stores-list-col-name">
                    <span className="stores-list-avatar" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l1-6h16l1 6" />
                        <path d="M4 9v11a1 1 0 001 1h14a1 1 0 001-1V9" />
                        <path d="M9 21v-6h6v6" />
                      </svg>
                    </span>
                    <div className="stores-list-name-wrap">
                      <div className="stores-list-name">{card.location.name}</div>
                      <div className="stores-list-meta mono">
                        {card.location.code ?? "-"}
                        {card.location.parent_location_name ? ` · ${card.location.parent_location_name}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="stores-list-col-stat"><span className="stores-list-stat-value">{card.itemCount}</span></div>
                  <div className="stores-list-col-stat"><span className="stores-list-stat-value">{card.availableUnits}</span></div>
                  <div className="stores-list-col-stat"><span className="stores-list-stat-value">{card.inTransitUnits}</span></div>
                  <div className="stores-list-col-stat"><span className="stores-list-stat-value stores-list-stat-total">{card.totalUnits}</span></div>
                  <div className="stores-list-col-status">
                    <span className={"pill " + (isOut ? "pill-neutral" : isLow ? "pill-warning" : "pill-success")}>
                      <span className={"status-dot " + (isOut || isLow ? "inactive" : "active")} />
                      {isOut ? "Empty" : isLow ? `${card.lowStockCount} low` : "Healthy"}
                    </span>
                  </div>
                  <div className="stores-list-col-arrow" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                  </div>
                </Link>
              );
            })}
            <div className="stores-list-foot mono">{cards.length} store{cards.length === 1 ? "" : "s"}</div>
          </div>
        )}
      </main>
    </div>
  );
}
