"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import { apiFetch } from "@/lib/api";
import { fetchAllPages } from "@/lib/stockEntryData";
import { useCapabilities, useCan } from "@/contexts/CapabilitiesContext";

interface LocationRecord {
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
  item_code: string;
  subcategory_name: string;
  batch: number | null;
  batch_number: string | null;
  quantity: number;
  in_transit_quantity: number;
  available_quantity: number;
  low_stock_threshold: number;
}

type FilterMode = "all" | "low" | "in_transit";

export default function StoreDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { isLoading: capsLoading } = useCapabilities();
  const canView = useCan("items");

  const [location, setLocation] = useState<LocationRecord | null>(null);
  const [rows, setRows] = useState<StockRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [loc, stockRows] = await Promise.all([
        apiFetch<LocationRecord>(`/api/inventory/locations/${params.id}/`),
        fetchAllPages<StockRow>(`/api/inventory/distribution/?location=${encodeURIComponent(params.id)}&page_size=1000`),
      ]);
      setLocation(loc);
      setRows(stockRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load store details");
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (capsLoading) return;
    if (!canView) {
      router.replace("/403");
      return;
    }
    void load();
  }, [canView, capsLoading, load, router]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = rows;
    if (filter === "low") {
      result = result.filter(r => r.available_quantity <= r.low_stock_threshold);
    } else if (filter === "in_transit") {
      result = result.filter(r => r.in_transit_quantity > 0);
    }
    if (q) {
      result = result.filter(r =>
        r.item_name.toLowerCase().includes(q) ||
        r.item_code?.toLowerCase().includes(q) ||
        (r.batch_number ?? "").toLowerCase().includes(q) ||
        (r.subcategory_name ?? "").toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => a.item_name.localeCompare(b.item_name) || (a.batch_number ?? "").localeCompare(b.batch_number ?? ""));
  }, [rows, search, filter]);

  const totals = useMemo(() => rows.reduce((acc, r) => ({
    items: acc.items.add(r.item),
    quantity: acc.quantity + r.quantity,
    available: acc.available + r.available_quantity,
    in_transit: acc.in_transit + r.in_transit_quantity,
    low: acc.low + (r.available_quantity <= r.low_stock_threshold ? 1 : 0),
  }), { items: new Set<number>(), quantity: 0, available: 0, in_transit: 0, low: 0 }), [rows]);

  return (
    <div>
      <Topbar breadcrumb={["Inventory", "Stores", location?.name ?? "Detail"]} />
      <main className="page">
        <Link className="page-back" href="/stores">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Back to Stores
        </Link>

        {error && (
          <div style={{ padding: "12px 16px", background: "var(--danger-weak)", border: "1px solid color-mix(in oklch, var(--danger) 30%, transparent)", borderRadius: "var(--radius)", color: "var(--danger)", fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {isLoading ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Loading store inventory…</div>
        ) : location ? (
          <>
            <div className="page-head">
              <div className="page-title-group">
                <h1>{location.name}</h1>
                <div className="page-sub">
                  <span className="mono" style={{ color: "var(--muted)" }}>{location.code}</span>
                  {location.parent_location_name ? <> · {location.parent_location_name}</> : null}
                </div>
              </div>
            </div>

            <div className="stores-summary">
              <div className="stores-summary-item stores-summary-accent">
                <div className="stores-summary-label">Distinct items</div>
                <div className="stores-summary-value">{totals.items.size}</div>
              </div>
              <div className="stores-summary-item">
                <div className="stores-summary-label">Available</div>
                <div className="stores-summary-value">{totals.available}</div>
              </div>
              <div className="stores-summary-item">
                <div className="stores-summary-label">In transit</div>
                <div className="stores-summary-value">{totals.in_transit}</div>
              </div>
              <div className="stores-summary-item">
                <div className="stores-summary-label">Total units</div>
                <div className="stores-summary-value">{totals.quantity}</div>
              </div>
              <div className="stores-summary-item stores-summary-warn">
                <div className="stores-summary-label">Low-stock</div>
                <div className="stores-summary-value">{totals.low}</div>
              </div>
            </div>

            <div className="filter-bar" style={{ marginTop: 16 }}>
              <div className="filter-bar-left">
                <label className="search-input">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
                  <input
                    placeholder="Search by item, code, batch, or subcategory…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onClick={e => { if (!e.currentTarget.value) e.currentTarget.setSelectionRange(0, 0); }}
                    onFocus={e => { if (!e.currentTarget.value) e.currentTarget.setSelectionRange(0, 0); }}
                  />
                  {search && <button type="button" className="clear-search" onClick={e => { e.preventDefault(); setSearch(""); }}>×</button>}
                </label>
              </div>
              <div className="filter-bar-right">
                <div className="seg" title="Quick filters">
                  <button type="button" className={"seg-btn" + (filter === "all" ? " active" : "")} onClick={() => setFilter("all")}>All</button>
                  <button type="button" className={"seg-btn" + (filter === "low" ? " active" : "")} onClick={() => setFilter("low")}>Low stock</button>
                  <button type="button" className={"seg-btn" + (filter === "in_transit" ? " active" : "")} onClick={() => setFilter("in_transit")}>In transit</button>
                </div>
              </div>
            </div>

            <div className="table-card">
              <div className="h-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th style={{ textAlign: "center" }}>Batch</th>
                      <th style={{ textAlign: "center" }}>Available</th>
                      <th style={{ textAlign: "center" }}>In transit</th>
                      <th style={{ textAlign: "center" }}>Total</th>
                      <th style={{ textAlign: "center" }}>Threshold</th>
                      <th style={{ textAlign: "center" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
                        {rows.length === 0 ? "This store has no stock yet." : "No items match your filters."}
                      </td></tr>
                    ) : filtered.map(row => {
                      const isLow = row.available_quantity <= row.low_stock_threshold;
                      const isOut = row.available_quantity === 0;
                      return (
                        <tr key={row.id}>
                          <td>
                            <Link href={`/items/${row.item}`} style={{ color: "inherit", textDecoration: "none" }}>
                              <div style={{ fontWeight: 600, color: "var(--ink)" }}>{row.item_name}</div>
                              <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
                                {row.item_code}{row.subcategory_name ? ` · ${row.subcategory_name}` : ""}
                              </div>
                            </Link>
                          </td>
                          <td className="mono" style={{ textAlign: "center" }}>{row.batch_number ?? <span className="muted-note">-</span>}</td>
                          <td className="mono" style={{ textAlign: "center", fontWeight: 600, color: isOut ? "var(--danger)" : isLow ? "var(--warn)" : "var(--ink)" }}>{row.available_quantity}</td>
                          <td className="mono" style={{ textAlign: "center" }}>{row.in_transit_quantity}</td>
                          <td className="mono" style={{ textAlign: "center" }}>{row.quantity}</td>
                          <td className="mono" style={{ textAlign: "center", color: "var(--muted)" }}>{row.low_stock_threshold}</td>
                          <td style={{ textAlign: "center" }}>
                            <span className={"pill " + (isOut ? "pill-danger" : isLow ? "pill-warning" : "pill-success")}>
                              <span className={"status-dot " + (isOut || isLow ? "inactive" : "active")} />
                              {isOut ? "Out of stock" : isLow ? "Low" : "Healthy"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!isLoading && filtered.length > 0 && (
                <div className="table-card-foot" style={{ justifyContent: "flex-start" }}>
                  <div className="pager-current">Showing {filtered.length} of {rows.length} line{rows.length === 1 ? "" : "s"}</div>
                </div>
              )}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
