"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Topbar } from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { apiFetch, type Page } from "@/lib/api";
import { formatListSummary } from "@/lib/userUiShared";
import { useToast } from "@/components/Toast";

export interface VendorRecord {
  id: number;
  name: string;
  code: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  tax_number: string;
  notes: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  created_by_name?: string | null;
}

interface VendorFormState {
  name: string;
  code: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  tax_number: string;
  notes: string;
  is_active: boolean;
}

const emptyForm: VendorFormState = {
  name: "",
  code: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
  tax_number: "",
  notes: "",
  is_active: true,
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function VendorsView() {
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VendorRecord | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await apiFetch<VendorRecord[] | Page<VendorRecord>>("/api/inventory/vendors/?page_size=500");
      const rows = Array.isArray(data) ? data : data.results;
      setVendors(rows);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load vendors");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter(v => {
      const hay = `${v.name} ${v.code} ${v.contact_person} ${v.phone} ${v.email}`.toLowerCase();
      return hay.includes(q);
    });
  }, [vendors, search]);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (v: VendorRecord) => { setEditing(v); setModalOpen(true); };

  const handleDelete = async (v: VendorRecord) => {
    if (!window.confirm(`Delete vendor ${v.name}?\n\nThis cannot be undone.`)) return;
    try {
      await apiFetch(`/api/inventory/vendors/${v.id}/`, { method: "DELETE" });
      setVendors(prev => prev.filter(x => x.id !== v.id));
      toast.success(`Vendor "${v.name}" deleted.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete vendor");
    }
  };

  return (
    <div>
      <Topbar breadcrumb={["Inventory", "Vendors"]} />
      <main className="page">
        <div className="page-head">
          <div className="page-title-group"><h1>Vendors</h1></div>
          <div className="page-head-actions">
            <Button type="button" size="sm" onClick={openCreate}>+ Add Vendor</Button>
          </div>
        </div>

        <div className="stock-entry-help" style={{ margin: "0 0 16px" }}>
          <div className="stock-entry-help-title">What are vendors?</div>
          <div className="stock-entry-help-body">
            Vendors are external suppliers, companies or individuals you receive stock from. They live outside the university location hierarchy and are referenced directly by stock entries that bring new inventory in.
          </div>
        </div>

        <div className="filter-bar">
          <div className="filter-bar-left">
            <label className="search-input">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
              <input
                placeholder="Search by name, code, contact, phone, or email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onClick={e => { if (!e.currentTarget.value) e.currentTarget.setSelectionRange(0, 0); }}
                onFocus={e => { if (!e.currentTarget.value) e.currentTarget.setSelectionRange(0, 0); }}
              />
              {search && <button type="button" className="clear-search" onClick={e => { e.preventDefault(); setSearch(""); }}>×</button>}
            </label>
          </div>
        </div>

        {fetchError ? (
          <div className="table-card"><div style={{ padding: 24, color: "var(--danger)", fontSize: 13 }}>{fetchError}</div></div>
        ) : (
          <div className="table-card">
            <div className="h-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th style={{ textAlign: "center" }}>Contact</th>
                    <th style={{ textAlign: "center" }}>Phone</th>
                    <th style={{ textAlign: "center" }}>Email</th>
                    <th style={{ textAlign: "center" }}>Status</th>
                    <th style={{ textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Loading vendors…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>No vendors yet. Add your first vendor to get started.</td></tr>
                  ) : filtered.map(v => (
                    <tr key={v.id}>
                      <td className="col-user">
                        <div className="location-row-cell">
                          <span className="location-card-avatar" aria-hidden="true">{initialsOf(v.name)}</span>
                          <div className="location-row-text">
                            <div className="user-name">{v.name}</div>
                            <div className="user-username mono">{v.code}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: "center" }}>{v.contact_person || <span className="muted-note">-</span>}</td>
                      <td style={{ textAlign: "center" }}>{v.phone || <span className="muted-note">-</span>}</td>
                      <td style={{ textAlign: "center" }}>{v.email || <span className="muted-note">-</span>}</td>
                      <td style={{ textAlign: "center" }}>
                        <span className={"pill " + (v.is_active ? "pill-success" : "pill-neutral")}>
                          <span className={"status-dot " + (v.is_active ? "active" : "inactive")} />
                          {v.is_active ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="col-actions">
                        <div className="row-actions row-actions-fixed">
                          <Button type="button" variant="ghost" size="xs" className="row-action" onClick={() => openEdit(v)} title="Edit vendor">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                            <span className="ra-label">Edit</span>
                          </Button>
                          <Button type="button" variant="outline" size="xs" className="btn-danger-ghost row-action" onClick={() => handleDelete(v)} title="Delete vendor">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" /><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>
                            <span className="ra-label">Delete</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!isLoading && filtered.length > 0 && (
              <div className="table-card-foot" style={{ justifyContent: "flex-start" }}>
                <div className="pager-current">{formatListSummary(filtered.length, 1, filtered.length, "vendor", "vendors")}</div>
              </div>
            )}
          </div>
        )}

        {modalOpen && (
          <VendorModal
            vendor={editing}
            onClose={() => { setModalOpen(false); setEditing(null); }}
            onSaved={() => { setModalOpen(false); setEditing(null); void load(); }}
          />
        )}
      </main>
    </div>
  );
}

function VendorModal({ vendor, onClose, onSaved }: { vendor: VendorRecord | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<VendorFormState>(() =>
    vendor
      ? {
          name: vendor.name,
          code: vendor.code,
          contact_person: vendor.contact_person,
          phone: vendor.phone,
          email: vendor.email,
          address: vendor.address,
          tax_number: vendor.tax_number,
          notes: vendor.notes,
          is_active: vendor.is_active,
        }
      : emptyForm,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<VendorFormState>) => setForm(prev => ({ ...prev, ...patch }));

  const submit = async () => {
    if (!form.name.trim()) { setError("Vendor name is required."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const body = JSON.stringify({
        name: form.name.trim(),
        code: form.code.trim(),
        contact_person: form.contact_person.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        tax_number: form.tax_number.trim(),
        notes: form.notes.trim(),
        is_active: form.is_active,
      });
      if (vendor) {
        await apiFetch(`/api/inventory/vendors/${vendor.id}/`, { method: "PATCH", body });
      } else {
        await apiFetch("/api/inventory/vendors/", { method: "POST", body });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save vendor");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{vendor ? "Edit Vendor" : "Add Vendor"}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">
          <div style={{ padding: "20px 24px", display: "grid", gap: 14 }}>
            {error && (
              <div style={{ padding: "10px 14px", background: "var(--danger-weak)", border: "1px solid color-mix(in oklch, var(--danger) 30%, transparent)", borderRadius: "var(--radius)", color: "var(--danger)", fontSize: 13 }}>{error}</div>
            )}
            <div className="form-grid cols-2">
              <div className="field">
                <div className="field-label">Vendor name <span className="field-req">*</span></div>
                <input className="input" value={form.name} onChange={e => set({ name: e.target.value })} placeholder="Techno Solutions Pvt Ltd" autoComplete="off" spellCheck={false} />
              </div>
              <div className="field">
                <div className="field-label">Vendor code</div>
                <input className="input" value={form.code} onChange={e => set({ code: e.target.value.toUpperCase() })} placeholder="Leave blank to auto-generate" autoComplete="off" spellCheck={false} />
                <div className="field-hint">Auto-generated as VEND-0001 if left blank.</div>
              </div>
              <div className="field">
                <div className="field-label">Contact person</div>
                <input className="input" value={form.contact_person} onChange={e => set({ contact_person: e.target.value })} placeholder="Account manager / sales rep" autoComplete="off" spellCheck={false} />
              </div>
              <div className="field">
                <div className="field-label">Phone</div>
                <input className="input" type="tel" value={form.phone} onChange={e => set({ phone: e.target.value })} placeholder="+92 300 1234567" autoComplete="off" />
              </div>
              <div className="field" style={{ gridColumn: "span 2" }}>
                <div className="field-label">Email</div>
                <input className="input" type="email" value={form.email} onChange={e => set({ email: e.target.value })} placeholder="sales@vendor.com" autoComplete="off" spellCheck={false} />
              </div>
              <div className="field" style={{ gridColumn: "span 2" }}>
                <div className="field-label">Address</div>
                <textarea className="textarea-field" rows={2} value={form.address} onChange={e => set({ address: e.target.value })} placeholder="Full postal address" autoComplete="off" spellCheck={false} />
              </div>
              <div className="field">
                <div className="field-label">Tax / NTN number</div>
                <input className="input" value={form.tax_number} onChange={e => set({ tax_number: e.target.value })} placeholder="Optional" autoComplete="off" spellCheck={false} />
              </div>
              <div className="field">
                <div className="field-label">Active state</div>
                <div className="seg">
                  <button type="button" className={"seg-btn" + (form.is_active ? " active" : "")} onClick={() => set({ is_active: true })}>Active</button>
                  <button type="button" className={"seg-btn" + (!form.is_active ? " active" : "")} onClick={() => set({ is_active: false })}>Disabled</button>
                </div>
              </div>
              <div className="field" style={{ gridColumn: "span 2" }}>
                <div className="field-label">Notes</div>
                <textarea className="textarea-field" rows={2} value={form.notes} onChange={e => set({ notes: e.target.value })} placeholder="Internal notes about this vendor" autoComplete="off" spellCheck={false} />
              </div>
            </div>
          </div>
        </div>
        <footer className="modal-foot">
          <div className="modal-foot-actions" style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "12px 20px" }}>
            <Button type="button" variant="outline" size="md" onClick={onClose}>Cancel</Button>
            <Button type="button" size="md" onClick={submit} disabled={submitting}>{submitting ? "Saving…" : vendor ? "Save changes" : "Add vendor"}</Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
