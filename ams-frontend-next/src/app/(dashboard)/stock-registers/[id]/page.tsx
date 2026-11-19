"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { useCan, useCapabilities } from "@/contexts/CapabilitiesContext";
import { apiFetch, type Page } from "@/lib/api";
import { registerTypeFullName, type StockRegisterRecord } from "@/lib/userUiShared";

interface StockRegisterWithDepartment extends StockRegisterRecord {
  department?: { id: number; name: string } | null;
}

type EntryType = "RECEIPT" | "ISSUE" | "RETURN";
type EntryStatus = "DRAFT" | "PENDING_ACK" | "COMPLETED" | "REJECTED" | "CANCELLED" | "VOIDED";

interface StockEntryItemRecord {
  id?: number;
  item: number;
  item_name?: string | null;
  batch: number | null;
  batch_number?: string | null;
  quantity: number;
  instances?: number[];
  stock_register: number | null;
  stock_register_name?: string | null;
  page_number: number | null;
  ack_stock_register: number | null;
  ack_stock_register_name?: string | null;
  ack_page_number: number | null;
}

interface StockEntryRecord {
  id: number;
  entry_type: EntryType;
  entry_number: string;
  entry_date: string;
  from_location_name?: string | null;
  to_location_name?: string | null;
  issued_to_name?: string | null;
  status: EntryStatus;
  remarks: string | null;
  items: StockEntryItemRecord[];
  created_at: string;
  updated_at?: string | null;
}

const Ic = ({ d, size = 14 }: { d: React.ReactNode | string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true" focusable="false">
    {typeof d === "string" ? <path d={d} /> : d}
  </svg>
);

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
  } catch {
    return value;
  }
}

function entryStatusTone(status: EntryStatus) {
  if (status === "COMPLETED") return "pill-success";
  if (status === "CANCELLED" || status === "REJECTED" || status === "VOIDED") return "pill-danger";
  return "pill-warning";
}

function entryStatusLabel(status: EntryStatus) {
  return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function summarizeItems(items: StockEntryItemRecord[]): { label: string; totalQty: number } {
  if (!items.length) return { label: "No items", totalQty: 0 };
  const totalQty = items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
  const first = items[0].item_name ?? "Item";
  const rest = items.length - 1;
  const label = rest > 0 ? `${first} +${rest} more` : first;
  return { label, totalQty };
}

type EntryRole = "source" | "ack" | "both";

type EntryOnRegister = {
  entry: StockEntryRecord;
  role: EntryRole;
  pageNumber: number | null;
};

function tagEntriesForRegister(entries: StockEntryRecord[], registerId: number): EntryOnRegister[] {
  const results: EntryOnRegister[] = [];
  for (const entry of entries) {
    let hasSource = false;
    let hasAck = false;
    let sourcePage: number | null = null;
    let ackPage: number | null = null;
    for (const item of entry.items ?? []) {
      if (item.stock_register === registerId) {
        hasSource = true;
        if (sourcePage == null) sourcePage = item.page_number;
      }
      if (item.ack_stock_register === registerId) {
        hasAck = true;
        if (ackPage == null) ackPage = item.ack_page_number;
      }
    }
    if (!hasSource && !hasAck) continue;
    const role: EntryRole = hasSource && hasAck ? "both" : hasSource ? "source" : "ack";
    const pageNumber = hasSource ? sourcePage : ackPage;
    results.push({ entry, role, pageNumber });
  }
  return results;
}

function roleLabel(role: EntryRole): string {
  if (role === "both") return "Recorded & acknowledged on this register";
  if (role === "ack") return "Acknowledged on this register";
  return "Recorded on this register";
}

export default function DigitalRegisterDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const registerId = Number(params?.id);
  const { isLoading: capsLoading } = useCapabilities();
  const canView = useCan("stock-registers");

  const [register, setRegister] = useState<StockRegisterWithDepartment | null>(null);
  const [entries, setEntries] = useState<StockEntryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [entriesError, setEntriesError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(registerId)) {
      setFetchError("Invalid register id");
      setIsLoading(false);
      setEntriesLoading(false);
      return;
    }
    setIsLoading(true);
    setFetchError(null);
    try {
      const registerData = await apiFetch<StockRegisterWithDepartment>(
        `/api/inventory/stock-registers/${registerId}/`,
      );
      setRegister(registerData);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load register");
    } finally {
      setIsLoading(false);
    }
  }, [registerId]);

  const loadEntries = useCallback(async () => {
    if (!Number.isFinite(registerId)) return;
    setEntriesLoading(true);
    setEntriesError(null);
    try {
      const data = await apiFetch<Page<StockEntryRecord> | StockEntryRecord[]>(
        `/api/inventory/stock-registers/${registerId}/entries/`,
      );
      setEntries(Array.isArray(data) ? data : data.results);
    } catch (err) {
      setEntriesError(err instanceof Error ? err.message : "Failed to load linked entries");
      setEntries([]);
    } finally {
      setEntriesLoading(false);
    }
  }, [registerId]);

  useEffect(() => {
    if (capsLoading) return;
    if (!canView) {
      router.replace("/403");
      return;
    }
    load();
    loadEntries();
  }, [capsLoading, canView, load, loadEntries, router]);

  const departmentName = register?.department?.name ?? "Unassigned";

  const linked = useMemo(
    () => (register ? tagEntriesForRegister(entries, register.id) : []),
    [entries, register],
  );

  return (
    <div data-density="balanced">
      <Topbar breadcrumb={["Operations", "Stock Registers", register?.register_number ?? "Register"]} />

      <div className="page">
        {fetchError && (
          <div style={{ padding: "12px 16px", background: "var(--danger-weak)", border: "1px solid color-mix(in oklch, var(--danger) 30%, transparent)", borderRadius: "var(--radius)", color: "var(--danger)", fontSize: 13, marginBottom: 16 }}>
            {fetchError}
          </div>
        )}

        <div className="page-head" style={{ gap: 12 }}>
          <div className="page-title-group">
            <div className="eyebrow mono" style={{ marginBottom: 4 }}>
              <Link href="/stock-registers" style={{ color: "var(--text-2)" }}>
                Stock Registers
              </Link>
            </div>
            <h1>{register?.register_number ?? (isLoading ? "Loading…" : "Register")}</h1>
            {register && (
              <div className="muted-note" style={{ marginTop: 4 }}>
                <span title={registerTypeFullName(register.register_type)}>
                  {register.register_type}
                </span>
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Button type="button" variant="outline" size="sm" onClick={() => router.push("/stock-registers")}>
              <Ic d="M15 18l-6-6 6-6" size={12} />
              <span>Back</span>
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: "32px 0", textAlign: "center", color: "var(--text-2)", fontSize: 13 }}>
            Loading register…
          </div>
        ) : register ? (
          <>
            <div className="table-card" style={{ padding: 16, marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16 }}>
                <div>
                  <div className="eyebrow">Register number</div>
                  <div className="mono" style={{ fontSize: 14, color: "var(--text-1)" }}>{register.register_number}</div>
                </div>
                <div>
                  <div className="eyebrow">Type</div>
                  <div style={{ fontSize: 14, color: "var(--text-1)" }}>
                    <span className="chip" title={registerTypeFullName(register.register_type)}>{register.register_type}</span>
                  </div>
                </div>
                <div>
                  <div className="eyebrow">Store</div>
                  <div style={{ fontSize: 14, color: "var(--text-1)" }}>{register.store_name ?? "Unknown store"}</div>
                </div>
                <div>
                  <div className="eyebrow">Department</div>
                  <div style={{ fontSize: 14, color: "var(--text-1)" }}>{departmentName}</div>
                </div>
                <div>
                  <div className="eyebrow">Status</div>
                  <div style={{ fontSize: 14 }}>
                    <span className={"pill " + (register.is_active ? "pill-success" : "pill-neutral")}>
                      <span className={"status-dot " + (register.is_active ? "active" : "inactive")} />
                      {register.is_active ? "Active" : "Closed"}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="eyebrow">Created by</div>
                  <div className="mono" style={{ fontSize: 13, color: "var(--text-1)" }}>{register.created_by_name ?? "Unknown"}</div>
                </div>
                {!register.is_active && register.closed_at && (
                  <div>
                    <div className="eyebrow">Closed</div>
                    <div className="mono" style={{ fontSize: 13, color: "var(--text-1)" }}>
                      {formatDate(register.closed_at)}
                    </div>
                    {register.closed_reason ? (
                      <div className="muted-note" style={{ marginTop: 2, fontSize: 12 }}>{register.closed_reason}</div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "0 2px 10px 2px" }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "var(--text-1)" }}>Linked stock entries</h2>
              <span className="eyebrow mono">{linked.length} entr{linked.length === 1 ? "y" : "ies"}</span>
            </div>

            {entriesError && (
              <div style={{ padding: "12px 16px", background: "var(--danger-weak)", border: "1px solid color-mix(in oklch, var(--danger) 30%, transparent)", borderRadius: "var(--radius)", color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>
                {entriesError}
              </div>
            )}

            <div className="table-card">
              <div className="h-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Entry</th>
                      <th>Type</th>
                      <th>Date</th>
                      <th>Items</th>
                      <th>Quantity</th>
                      <th>Page</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entriesLoading ? (
                      <tr>
                        <td colSpan={8}>
                          <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--text-2)", fontSize: 13 }}>
                            Loading entries…
                          </div>
                        </td>
                      </tr>
                    ) : linked.length === 0 ? (
                      <tr>
                        <td colSpan={8}>
                          <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--text-2)", fontSize: 13 }}>
                            No stock entries have been recorded against this register yet.
                          </div>
                        </td>
                      </tr>
                    ) : (
                      linked.map(({ entry, role, pageNumber }) => {
                        const { label, totalQty } = summarizeItems(entry.items ?? []);
                        return (
                          <tr
                            key={entry.id}
                            onClick={() => router.push(`/stock-entries/${entry.id}`)}
                            style={{ cursor: "pointer" }}
                          >
                            <td className="col-user">
                              <div className="user-cell">
                                <div>
                                  <div className="user-name">{entry.entry_number}</div>
                                  <div className="user-username mono">
                                    {roleLabel(role)}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="chip">{entry.entry_type}</span>
                            </td>
                            <td className="mono" style={{ fontSize: 13 }}>{formatDate(entry.entry_date)}</td>
                            <td style={{ fontSize: 13, color: "var(--text-1)" }}>{label}</td>
                            <td className="mono" style={{ fontSize: 13 }}>{totalQty}</td>
                            <td className="mono" style={{ fontSize: 13 }}>
                              {pageNumber == null ? <span className="muted-note">—</span> : pageNumber}
                            </td>
                            <td>
                              <span className={"pill " + entryStatusTone(entry.status)}>
                                {entryStatusLabel(entry.status)}
                              </span>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <Link
                                href={`/stock-entries/${entry.id}`}
                                className="row-action"
                                onClick={(e) => e.stopPropagation()}
                                style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-2)" }}
                              >
                                <span>View</span>
                                <Ic d="M9 6l6 6-6 6" size={12} />
                              </Link>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
