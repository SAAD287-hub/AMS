"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemedSelect } from "@/components/ThemedSelect";
import { Topbar } from "@/components/Topbar";
import { useCan, useCapabilities } from "@/contexts/CapabilitiesContext";
import { apiFetch, type Page } from "@/lib/api";
import { relTime, type StockRegisterRecord } from "@/lib/userUiShared";

type StockRegister = StockRegisterRecord & {
  department?: { id: number; name: string } | null;
};

type DensityMode = "compact" | "balanced" | "comfortable";

const Ic = ({ d, size = 14 }: { d: React.ReactNode | string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true" focusable="false">
    {typeof d === "string" ? <path d={d} /> : d}
  </svg>
);

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={"pill " + (active ? "pill-success" : "pill-neutral")}>
      <span className={"status-dot " + (active ? "active" : "inactive")} />
      {active ? "Active" : "Closed"}
    </span>
  );
}

type Department = {
  id: number | null;
  name: string;
};

export default function DigitalRegistersPage() {
  const router = useRouter();
  const { isLoading: capsLoading } = useCapabilities();
  const canView = useCan("stock-registers");

  const [registers, setRegisters] = useState<StockRegister[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "closed">("all");
  const [density, setDensity] = useState<DensityMode>("balanced");

  const load = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const registersData = await apiFetch<Page<StockRegister> | StockRegister[]>(
        "/api/inventory/stock-registers/?page_size=500",
      );
      setRegisters(Array.isArray(registersData) ? registersData : registersData.results);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load digital registers");
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
    load();
  }, [capsLoading, canView, load, router]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return registers.filter(register => {
      if (statusFilter === "active" && !register.is_active) return false;
      if (statusFilter === "closed" && register.is_active) return false;
      if (!query) return true;
      const haystack = [
        register.register_number,
        register.store_name ?? "",
        register.department?.name ?? "Unassigned",
        register.register_type === "CSR" ? "consumable" : "dead stock",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [registers, search, statusFilter]);

  const grouped = useMemo(() => {
    const buckets = new Map<string, { department: Department; items: StockRegister[] }>();
    filtered.forEach(register => {
      const dept: Department = register.department
        ? { id: register.department.id, name: register.department.name }
        : { id: null, name: "Unassigned" };
      const key = dept.id === null ? "__unassigned__" : String(dept.id);
      const existing = buckets.get(key);
      if (existing) {
        existing.items.push(register);
      } else {
        buckets.set(key, { department: dept, items: [register] });
      }
    });
    const list = Array.from(buckets.values());
    list.sort((a, b) => {
      if (a.department.id === null && b.department.id !== null) return 1;
      if (b.department.id === null && a.department.id !== null) return -1;
      return a.department.name.localeCompare(b.department.name);
    });
    list.forEach(group => {
      group.items.sort((a, b) => a.register_number.localeCompare(b.register_number));
    });
    return list;
  }, [filtered]);

  const totalDepartments = grouped.length;
  const totalRegisters = filtered.length;

  return (
    <div data-density={density}>
      <Topbar breadcrumb={["Operations", "Digital Registers"]} />

      <div className="page">
        {fetchError && (
          <div style={{ padding: "12px 16px", background: "var(--danger-weak)", border: "1px solid color-mix(in oklch, var(--danger) 30%, transparent)", borderRadius: "var(--radius)", color: "var(--danger)", fontSize: 13, marginBottom: 16 }}>
            {fetchError}
          </div>
        )}

        <div className="page-head">
          <div className="page-title-group">
            <h1>Digital Registers</h1>
            <div className="muted-note" style={{ marginTop: 4 }}>
              Browse registers grouped by department. Open a register to see the stock entries recorded against it.
            </div>
          </div>
        </div>

        <div className="filter-bar">
          <div className="filter-bar-left">
            <label className="search-input">
              <Ic d={<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>} size={14} />
              <input
                placeholder="Search by register, store, or department…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && <button type="button" className="clear-search" onClick={e => { e.preventDefault(); setSearch(""); }}>×</button>}
            </label>

            <div className="filter-select-group">
              <div className="chip-filter-label">Status</div>
              <div className="filter-select-wrap">
                <ThemedSelect
                  value={statusFilter}
                  onChange={(value) => setStatusFilter(value as "all" | "active" | "closed")}
                  size="compact"
                  ariaLabel="Filter digital registers by status"
                  options={[
                    { value: "all", label: "All statuses" },
                    { value: "active", label: "Active" },
                    { value: "closed", label: "Closed" },
                  ]}
                />
              </div>
            </div>
          </div>

          <div className="filter-bar-right">
            <div className="seg" title="Row density">
              {(["compact", "balanced", "comfortable"] as const).map((option) => (
                <button type="button" key={option} className={"seg-btn" + (density === option ? " active" : "")} onClick={() => setDensity(option)}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: "32px 0", textAlign: "center", color: "var(--text-2)", fontSize: 13 }}>
            Loading digital registers…
          </div>
        ) : grouped.length === 0 ? (
          <div className="table-card">
            <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
              No digital registers match the current filters.
            </div>
          </div>
        ) : (
          <>
            <div className="muted-note mono" style={{ marginBottom: 12 }}>
              {totalRegisters} register{totalRegisters === 1 ? "" : "s"} across {totalDepartments} department{totalDepartments === 1 ? "" : "s"}
            </div>
            {grouped.map(group => (
              <section key={group.department.id ?? "unassigned"} style={{ marginBottom: 24 }}>
                <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "0 0 10px 0", padding: "0 2px" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: 0.2, color: "var(--text-1)", margin: 0 }}>
                      {group.department.name}
                    </h2>
                    <span className="eyebrow mono">{group.items.length} register{group.items.length === 1 ? "" : "s"}</span>
                  </div>
                </header>
                <div className="table-card">
                  <div className="h-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Register</th>
                          <th>Type</th>
                          <th>Store</th>
                          <th>Status</th>
                          <th>Updated</th>
                          <th style={{ textAlign: "right" }}>Open</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map(register => (
                          <tr
                            key={register.id}
                            onClick={() => router.push(`/digital-registers/${register.id}`)}
                            style={{ cursor: "pointer" }}
                          >
                            <td className="col-user">
                              <div className="user-cell">
                                <div>
                                  <div className="user-name">{register.register_number}</div>
                                  <div className="user-username mono">{register.store_name ?? "Unknown store"}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="chip">
                                {register.register_type === "CSR" ? "Consumable" : "Dead Stock"}
                              </span>
                            </td>
                            <td>
                              <span className="chip chip-loc">{register.store_name ?? "Unknown store"}</span>
                            </td>
                            <td>
                              <StatusPill active={register.is_active} />
                            </td>
                            <td className="col-login">
                              <div className="login-cell">
                                <div>{relTime(register.updated_at)}</div>
                              </div>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <Link
                                href={`/digital-registers/${register.id}`}
                                className="row-action"
                                onClick={(e) => e.stopPropagation()}
                                style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-2)" }}
                              >
                                <span>View</span>
                                <Ic d="M9 6l6 6-6 6" size={12} />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
