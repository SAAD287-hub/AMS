"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ListPagination } from "@/components/ListPagination";
import { ThemedSelect } from "@/components/ThemedSelect";
import { Topbar } from "@/components/Topbar";
import { CategoryModal, type CategoryRecord } from "@/components/CategoryModal";
import { apiFetch, friendlyMessage, type Page } from "@/lib/api";
import { useCan, useCapabilities } from "@/contexts/CapabilitiesContext";
import { useCopilotAction } from "@/hooks/useCopilotAction";
import { useCopilotListControls } from "@/hooks/useCopilotListControls";
import { useCopilotReadable } from "@/hooks/useCopilotReadable";
import {
  consumePendingOpen,
  SAME_PAGE_OPEN_EVENT,
} from "@/lib/copilotPendingAction";
import { buildCopilotDetailContext, buildCopilotListContext } from "@/lib/copilotPageContext";
import { useClientPagination } from "@/lib/listPagination";
import { relTime } from "@/lib/userUiShared";
import { Button } from "@/components/ui/button";


const Ic = ({ d, size = 16 }: { d: React.ReactNode | string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true" focusable="false">
    {typeof d === "string" ? <path d={d} /> : d}
  </svg>
);

type CategoryListVariant = "root" | "children";

const CATEGORIES_PAGE_SIZE = 15;

interface CategoryListViewProps {
  variant: CategoryListVariant;
  parentId?: string;
}

function formatLabel(value: string | null | undefined, fallback = "-") {
  if (!value) return fallback;
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={"pill " + (active ? "pill-success" : "pill-neutral")}>
      <span className={"status-dot " + (active ? "active" : "inactive")} />
      {active ? "Active" : "Disabled"}
    </span>
  );
}

function deleteBlockedMessage(blockers: string[] | undefined, fallback: string) {
  return blockers && blockers.length > 0 ? blockers.map(friendlyMessage).join(" ") : fallback;
}

function canDeleteExcludingSubcategories(category: CategoryRecord) {
  const blockers = category.delete_blockers ?? [];
  const otherBlockers = blockers.filter(b => !b.toLowerCase().includes("subcategor"));
  return otherBlockers.length === 0;
}

function trackingChipClass(trackingType: string | null | undefined) {
  if (!trackingType) return "chip";
  if (trackingType === "INDIVIDUAL") return "chip chip-tracking chip-tracking-individual";
  if (trackingType === "QUANTITY") return "chip chip-tracking chip-tracking-quantity";
  return "chip chip-tracking chip-tracking-perishable";
}

function CategoryActions() {
  return <span className="muted-note mono">No actions</span>;
}

function RowActions({ onEdit, onDelete, canEdit, canDelete, disabled = false, deleteBusy = false }: { onEdit?: () => void; onDelete?: () => void; canEdit: boolean; canDelete: boolean; disabled?: boolean; deleteBusy?: boolean }) {
  const canRenderEdit = canEdit && Boolean(onEdit);
  const canRenderDelete = canDelete && Boolean(onDelete);

  if (!canRenderEdit && !canRenderDelete) return <CategoryActions />;

  return (
    <div className="row-actions row-actions-fixed">
      {canRenderEdit ? (
        <Button type="button" variant="ghost" size="xs" className="row-action" onClick={event => { event.stopPropagation(); onEdit?.(); }} title="Edit category" disabled={disabled}>
          <Ic d="M12 20h9 M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" size={13} />
          <span className="ra-label">Edit</span>
        </Button>
      ) : <span className="row-action-slot" aria-hidden="true" />}
      {canRenderDelete ? (
        <Button type="button" variant="outline" size="xs" className="btn-danger-ghost row-action" onClick={event => { event.stopPropagation(); onDelete?.(); }} title="Delete category" disabled={disabled}>
          <Ic d="M3 6h18 M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6 M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2 M10 11v6 M14 11v6" size={13} />
          <span className="ra-label">{deleteBusy ? "Deleting…" : "Delete"}</span>
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="btn-danger-ghost row-action"
          disabled
          title="Cannot delete: has subcategories or dependent records"
          onClick={event => event.stopPropagation()}
        >
          <Ic d="M3 6h18 M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6 M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2 M10 11v6 M14 11v6" size={13} />
          <span className="ra-label">Delete</span>
        </Button>
      )}
    </div>
  );
}

function CategoryRow({ category, isChildrenView, childCount, childNames, trackingSummary, canEdit, canDelete, onOpen, onEdit, onDelete, onAddSubcategory, disabled = false, deleteBusy = false }: { category: CategoryRecord; isChildrenView: boolean; childCount: number; childNames: string[]; trackingSummary: string; canEdit: boolean; canDelete: boolean; onOpen?: () => void; onEdit?: () => void; onDelete?: () => void; onAddSubcategory?: () => void; disabled?: boolean; deleteBusy?: boolean }) {
  const resolvedType = category.resolved_category_type ?? category.category_type;
  const resolvedTracking = category.resolved_tracking_type ?? category.tracking_type;

  return (
    <tr onClick={onOpen} style={onOpen ? { cursor: "pointer" } : undefined}>
      <td className="col-user">
        <div className="user-cell">
          <div>
            <div className="user-name">{category.name}</div>
            <div className="user-username mono">{category.code}</div>
          </div>
        </div>
      </td>
      <td>
        <div className="group-cell">
          <span className="chip">{formatLabel(resolvedType)}</span>
          {resolvedType !== category.category_type && <span className="muted-note mono">Raw: {formatLabel(category.category_type)}</span>}
        </div>
      </td>
      {isChildrenView ? (
        <td>
          <div className="group-cell">
            <span className={trackingChipClass(resolvedTracking)}>{formatLabel(resolvedTracking)}</span>
            {resolvedTracking !== category.tracking_type && <span className="muted-note mono">Raw: {formatLabel(category.tracking_type)}</span>}
          </div>
        </td>
      ) : (
        <td>
          {trackingSummary && trackingSummary !== "No subcategories"
            ? <span className="chip">{trackingSummary}</span>
            : <span className="muted-note">-</span>}
        </td>
      )}
      {isChildrenView && <td>{category.parent_category_display ?? "Root category"}</td>}
      <td><StatusPill active={category.is_active} /></td>
      <td className="col-login">
        <div className="login-cell">
          <div>{category.updated_at ? relTime(category.updated_at) : "Unknown"}</div>
        </div>
      </td>
      {!isChildrenView && (
        <td className="col-add-sub">
          {onAddSubcategory ? (
            <button
              type="button"
              className="subcategory-add-btn"
              onClick={e => { e.stopPropagation(); if (!disabled) onAddSubcategory(); }}
              disabled={disabled}
              title="Add subcategory"
            >
              <Ic d="M12 5v14M5 12h14" size={11} />
              <span>Add</span>
            </button>
          ) : (
            <span className="muted-note">-</span>
          )}
        </td>
      )}
      <td className="col-actions">
        <RowActions canEdit={canEdit} canDelete={canDelete} onEdit={onEdit} onDelete={onDelete} disabled={disabled} deleteBusy={deleteBusy} />
      </td>
    </tr>
  );
}

function CategoryCard({ category, childCount, childNames, trackingSummary, canEdit, canDelete, pageBusy, deleteBusy, onOpen, onEdit, onDelete, onAddSubcategory }: { category: CategoryRecord; childCount: number; childNames: string[]; trackingSummary: string; canEdit: boolean; canDelete: boolean; pageBusy: boolean; deleteBusy: boolean; onOpen?: () => void; onEdit: () => void; onDelete: () => void; onAddSubcategory?: () => void }) {
  const resolvedType = category.resolved_category_type ?? category.category_type;
  const resolvedTracking = category.resolved_tracking_type ?? category.tracking_type;

  return (
    <div className="location-card" data-status={category.is_active ? "active" : "inactive"} onClick={onOpen} style={onOpen ? { cursor: "pointer" } : undefined}>
      <div className="location-card-head">
        <div className="location-card-icon" aria-hidden="true">
          <Ic d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" size={20} />
        </div>
        <div className="location-card-title-wrap">
          <div className="location-card-title-row">
            <div className="location-card-name" title={category.name}>{category.name}</div>
            <StatusPill active={category.is_active} />
          </div>
          <div className="location-card-sub">
            <span className="location-card-code mono">{category.code}</span>
            <span className="location-card-dot" aria-hidden="true">•</span>
            <span>{formatLabel(resolvedType)}</span>
          </div>
        </div>
      </div>

      <div className="location-card-meta">
        <div className="location-card-row">
          <span className="location-card-row-icon" aria-hidden="true">
            <Ic d="M3 6h18 M3 12h18 M3 18h18" size={13} />
          </span>
          <span className="location-card-label">Tracking</span>
          <span className="location-card-value">
            {resolvedTracking ? formatLabel(resolvedTracking) : trackingSummary}
          </span>
        </div>
        <div className="location-card-row">
          <span className="location-card-row-icon" aria-hidden="true">
            <Ic d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" size={13} />
          </span>
          <span className="location-card-label">Parent</span>
          <span className={"location-card-value" + (!category.parent_category_display ? " muted-value" : "")}>
            {category.parent_category_display ?? "Root category"}
          </span>
        </div>
      </div>

      {onAddSubcategory && (
        <div className="category-card-subs">
          <div className="category-card-subs-head">
            <span className="eyebrow">Subcategories</span>
            <span className="category-card-subs-count mono">{childCount}</span>
          </div>
          <div className="category-card-subs-body">
            {childCount === 0 ? (
              <span className="muted-note">No subcategories yet</span>
            ) : (
              <div className="category-card-subs-chips">
                {childNames.slice(0, 4).map(name => (
                  <span key={name} className="chip chip-sub">{name}</span>
                ))}
                {childCount > 4 ? <span className="chip chip-sub-more">+{childCount - 4}</span> : null}
              </div>
            )}
            <button
              type="button"
              className="subcategory-add-btn"
              onClick={e => { e.stopPropagation(); onAddSubcategory(); }}
              disabled={pageBusy}
              title="Add subcategory"
            >
              <Ic d="M12 5v14M5 12h14" size={11} />
              <span>Add</span>
            </button>
          </div>
        </div>
      )}

      <div className="location-card-foot">
        <div className="location-card-updated">
          <div className="eyebrow">Updated</div>
          <div className="user-card-last mono">{category.updated_at ? relTime(category.updated_at) : "Unknown"}</div>
        </div>
        <RowActions
          canEdit={canEdit}
          canDelete={canDelete}
          disabled={pageBusy}
          deleteBusy={deleteBusy}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

export function CategoryListView({ variant, parentId }: CategoryListViewProps) {
  const router = useRouter();
  const { isLoading: capsLoading } = useCapabilities();
  const canViewCategories = useCan("categories");
  const canManageCategories = useCan("categories", "manage");
  const canDeleteCategories = useCan("categories", "full");
  const [allCategories, setAllCategories] = useState<CategoryRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<number | null>(() => {
    if (variant === "children" && parentId) {
      const parsed = Number(parentId);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  });
  const parentCategory = useMemo(
    () => (selectedParentId == null ? null : allCategories.find(c => c.id === selectedParentId) ?? null),
    [allCategories, selectedParentId],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const density = "balanced" as const;
  const [mode, setMode] = useState<"table" | "grid">("table");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRecord | null>(null);
  const [subcategoryParent, setSubcategoryParent] = useState<CategoryRecord | null>(null);
  const [busyAction, setBusyAction] = useState<{ kind: "delete"; categoryId: number } | null>(null);

  const clearFetchError = useCallback(() => setFetchError(null), []);
  const clearActionError = useCallback(() => setActionError(null), []);

  const loadCategories = useCallback(async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
    if (showLoading) setIsLoading(true);
    setFetchError(null);
    try {
      const data = await apiFetch<Page<CategoryRecord> | CategoryRecord[]>("/api/inventory/categories/?page_size=500");
      const records = Array.isArray(data) ? data : data.results;
      setAllCategories(records);
      return true;
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load categories");
      return false;
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setCategories(allCategories.filter(category => (category.parent_category ?? null) === selectedParentId));
  }, [allCategories, selectedParentId]);

  useEffect(() => {
    if (capsLoading) return;
    if (!canViewCategories) {
      router.replace("/403");
      return;
    }
    loadCategories();
  }, [capsLoading, canViewCategories, loadCategories, router]);

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories.filter(category => {
      if (q) {
        const hay = [
          category.name,
          category.code,
          category.parent_category_display ?? "",
          category.category_type ?? "",
          category.tracking_type ?? "",
          category.resolved_category_type ?? "",
          category.resolved_tracking_type ?? "",
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (typeFilter !== "all" && (category.resolved_category_type ?? category.category_type) !== typeFilter) return false;
      if (statusFilter === "active" && !category.is_active) return false;
      if (statusFilter === "inactive" && category.is_active) return false;
      return true;
    });
  }, [categories, search, typeFilter, statusFilter]);

  const typeOptions = useMemo(() => {
    const values = new Set<string>();
    categories.forEach(category => {
      if (category.category_type) values.add(category.category_type);
      if (category.resolved_category_type) values.add(category.resolved_category_type);
    });
    return Array.from(values).sort();
  }, [categories]);

  const childCountByCategory = useMemo(() => {
    const counts = new Map<number, number>();
    allCategories.forEach(category => {
      if (category.parent_category != null) {
        counts.set(category.parent_category, (counts.get(category.parent_category) ?? 0) + 1);
      }
    });
    return counts;
  }, [allCategories]);

  const childNamesByCategory = useMemo(() => {
    const grouped = new Map<number, string[]>();
    allCategories
      .filter(category => category.parent_category != null)
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(category => {
        const parentKey = category.parent_category;
        if (parentKey == null) return;
        const current = grouped.get(parentKey) ?? [];
        current.push(category.name);
        grouped.set(parentKey, current);
      });
    return grouped;
  }, [allCategories]);

  const trackingSummaryByCategory = useMemo(() => {
    const summary = new Map<number, string>();
    allCategories
      .filter(category => category.parent_category != null)
      .forEach(category => {
        const parentId = category.parent_category;
        if (parentId == null) return;
        const tracking = formatLabel(category.resolved_tracking_type ?? category.tracking_type, "Unassigned");
        const existing = summary.get(parentId);
        if (!existing) {
          summary.set(parentId, tracking);
        } else if (!existing.split(" / ").includes(tracking)) {
          summary.set(parentId, `${existing} / ${tracking}`);
        }
      });
    return summary;
  }, [allCategories]);

  const {
    page,
    totalPages,
    pageItems: pagedCategories,
    pageStart,
    pageEnd,
    setPage,
  } = useClientPagination(filteredCategories, CATEGORIES_PAGE_SIZE, [search, typeFilter, statusFilter, variant, parentId]);

  const categoryListControls = useCopilotListControls({
    entity: variant === "children" ? "subcategory" : "category",
    filters: [
      {
        name: "search",
        type: "string",
        defaultValue: "",
        label: "Search",
        description: "Search by category name, code, parent, type, or tracking profile.",
        setValue: value => setSearch(String(value ?? "")),
      },
      {
        name: "type",
        type: "enum",
        defaultValue: "all",
        label: "Type",
        options: [
          { value: "all", label: "All types" },
          ...typeOptions.map(type => ({ value: type, label: formatLabel(type) })),
        ],
        setValue: value => setTypeFilter(String(value ?? "all")),
      },
      {
        name: "status",
        type: "enum",
        defaultValue: "all",
        label: "Status",
        options: [
          { value: "all", label: "All statuses" },
          { value: "active", label: "Active" },
          { value: "inactive", label: "Disabled" },
        ],
        setValue: value => setStatusFilter(String(value ?? "all")),
      },
    ],
    page,
    totalPages,
    setPage,
    visibleRows: pagedCategories.map((category, index) => ({
      row_number: index + 1,
      id: category.id,
      detail_route: `/categories/${category.id}`,
    })),
  });

  // Expose the categories (or subcategories under a parent) currently
  // displayed so the agent can resolve names → ids without a SQL lookup.
  const categoriesListReadable = useMemo(() => buildCopilotListContext({
    route: variant === "children" ? `/categories/${parentId}` : "/categories",
    entity: "category",
    total: categories.length,
    filteredTotal: filteredCategories.length,
    filters: {
      search: search || null,
      type: typeFilter,
      status: statusFilter,
    },
    pagination: { page, pageSize: CATEGORIES_PAGE_SIZE, totalPages },
    rows: pagedCategories.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      category_type: c.category_type ?? null,
      tracking_type: c.tracking_type ?? null,
      resolved_category_type: c.resolved_category_type ?? null,
      parent_category: c.parent_category,
      parent_category_display: c.parent_category_display ?? null,
      is_active: c.is_active,
      detail_route: `/categories/${c.id}`,
      available_actions: {
        open_detail: true,
        edit: canManageCategories,
        delete: canDeleteCategories,
        create_subcategory: canManageCategories && variant !== "children",
      },
    })),
    actions: {
      ...categoryListControls,
      create_category: canManageCategories && variant !== "children",
      create_subcategory: canManageCategories && variant === "children" && Boolean(parentCategory),
    },
    loading: isLoading || capsLoading,
    extra: {
      variant,
      parent_category: parentCategory
        ? { id: parentCategory.id, name: parentCategory.name, code: parentCategory.code }
        : null,
    },
  }), [
    variant,
    parentId,
    parentCategory,
    categories.length,
    filteredCategories.length,
    pagedCategories,
    search,
    typeFilter,
    statusFilter,
    canManageCategories,
    canDeleteCategories,
    capsLoading,
    isLoading,
    page,
    categoryListControls,
    totalPages,
  ]);

  useCopilotReadable({
    description:
      "Categories or subcategories under the current parent displayed after filters/pagination. Use visible_rows to resolve names to ids without SQL. When variant is children, parent_category identifies the subcategory scope; use get_app_map for form ids.",
    value: categoriesListReadable,
  });

  const categoryDetailReadable = useMemo(() => (
    variant === "children"
      ? buildCopilotDetailContext({
          route: `/categories/${parentId}`,
          entity: "category",
          selectedRecord: parentCategory
            ? {
                id: parentCategory.id,
                name: parentCategory.name,
                code: parentCategory.code,
                category_type: parentCategory.category_type,
                tracking_type: parentCategory.tracking_type,
                resolved_category_type: parentCategory.resolved_category_type,
                resolved_tracking_type: parentCategory.resolved_tracking_type,
                is_active: parentCategory.is_active,
                parent_category: parentCategory.parent_category,
                parent_category_display: parentCategory.parent_category_display,
                created_at: parentCategory.created_at,
                updated_at: parentCategory.updated_at,
              }
            : null,
          actions: {
            create_subcategory: canManageCategories && Boolean(parentCategory),
            edit: canManageCategories && Boolean(parentCategory),
            delete: canDeleteCategories && Boolean(parentCategory),
          },
          extra: {
            children_total: categories.length,
            children_filtered_total: filteredCategories.length,
            child_categories: categories.map(category => ({
              id: category.id,
              name: category.name,
              code: category.code,
              category_type: category.category_type,
              tracking_type: category.tracking_type,
              resolved_category_type: category.resolved_category_type,
              resolved_tracking_type: category.resolved_tracking_type,
              is_active: category.is_active,
              detail_route: `/categories/${category.id}`,
            })),
            visible_child_categories: pagedCategories.map(category => ({
              id: category.id,
              name: category.name,
              code: category.code,
              category_type: category.category_type,
              tracking_type: category.tracking_type,
              is_active: category.is_active,
              detail_route: `/categories/${category.id}`,
            })),
            filters: {
              search: search || null,
              type: typeFilter,
              status: statusFilter,
            },
          },
        })
      : null
  ), [
    canDeleteCategories,
    canManageCategories,
    categories,
    filteredCategories.length,
    pagedCategories,
    parentCategory,
    parentId,
    search,
    statusFilter,
    typeFilter,
    variant,
  ]);

  useCopilotReadable({
    description:
      "Category detail page contract. selected_record is the parent category and child_categories are the subcategories currently loaded for that parent.",
    value: categoryDetailReadable,
  });

  const openCreateModal = useCallback(() => {
    setEditingCategory(null);
    setSubcategoryParent(null);
    setModalOpen(true);
  }, []);

  const openAddSubcategoryFor = useCallback((category: CategoryRecord) => {
    setEditingCategory(null);
    setSubcategoryParent(category);
    setModalOpen(true);
  }, []);

  useCopilotAction({
    name: variant === "children" ? "open_create_subcategory_form" : "open_create_category_form",
    description: variant === "children"
      ? "Open the Add Subcategory modal on the current category page before filling a new subcategory."
      : "Open the Add Category modal on the Categories page before filling a new category.",
    parameters: {},
    allowed: canManageCategories && (variant !== "children" || Boolean(parentCategory)),
    enabled: variant !== "children" || Boolean(parentCategory),
    requiredCapabilities: [{ module: "categories", level: "manage" }],
    handler: () => {
      openCreateModal();
      return { ok: true };
    },
  });

  // Cross-page trigger: agent called open_form("category_create") from another
  // route, navigation deposited a token, we consume it on mount.
  // Subcategories use a different formId since they're scoped to a parent.
  useEffect(() => {
    if (variant !== "children" && consumePendingOpen("category_create") && canManageCategories) {
      openCreateModal();
    }
  }, [variant, canManageCategories, openCreateModal]);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ formId?: string }>).detail;
      if (variant === "children") {
        if (detail?.formId !== "subcategory_create") return;
        if (!canManageCategories || !parentCategory) return;
      } else {
        if (detail?.formId !== "category_create") return;
        if (!canManageCategories) return;
      }
      openCreateModal();
    };
    window.addEventListener(SAME_PAGE_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(SAME_PAGE_OPEN_EVENT, onOpen);
  }, [variant, canManageCategories, parentCategory, openCreateModal]);

  const openEditModal = useCallback((category: CategoryRecord) => {
    setEditingCategory(category);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingCategory(null);
  }, []);

  const handleSave = useCallback(async (savedCategory: CategoryRecord) => {
    const nextRecords = [
      savedCategory,
      ...allCategories.filter(category => category.id !== savedCategory.id),
    ];
    setAllCategories(nextRecords);
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
    const refreshed = await loadCategories({ showLoading: false });
    if (!refreshed) {
      setActionError("Category saved, but the list could not be refreshed. Reload to resync the list.");
    }
  }, [allCategories, loadCategories]);

  const handleDelete = useCallback(async (category: CategoryRecord) => {
    if (!canDeleteCategories) {
      setActionError("You do not have permission to delete categories.");
      return;
    }

    const blockers = category.delete_blockers ?? [];
    const subcategoryBlockerMsg = "This category has subcategories.";
    const hasSubcategoryBlocker = blockers.some(b => b.toLowerCase().includes("subcategor"));
    const otherBlockers = blockers.filter(b => !b.toLowerCase().includes("subcategor"));

    // Only hard-block deletion if blockers exist OTHER than the subcategory one.
    if (category.can_delete === false && otherBlockers.length > 0) {
      setActionError(deleteBlockedMessage(otherBlockers, "This category cannot be deleted because it is linked to existing records."));
      return;
    }

    if (busyAction) return;

    const subcategoryChildren = allCategories.filter(c => c.parent_category === category.id);
    const cascade = hasSubcategoryBlocker || subcategoryChildren.length > 0;
    const confirmed = cascade
      ? window.confirm(
          `Delete ${category.name} AND its ${subcategoryChildren.length} subcategor${subcategoryChildren.length === 1 ? "y" : "ies"} (${subcategoryChildren.map(c => c.name).join(", ")})?\n\nThis cannot be undone.`
        )
      : window.confirm(`Delete ${category.name}? This cannot be undone.`);
    if (!confirmed) return;

    setBusyAction({ kind: "delete", categoryId: category.id });
    clearActionError();

    try {
      await apiFetch(`/api/inventory/categories/${category.id}/${cascade ? "?cascade=true" : ""}`, {
        method: "DELETE",
      });
      const nextRecords = allCategories.filter(item => item.id !== category.id);
      setAllCategories(nextRecords);
      const refreshed = await loadCategories({ showLoading: false });
      if (!refreshed) {
        setActionError("Category deleted, but the list could not be refreshed. The row has been removed locally; reload to resync the list.");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete category");
    } finally {
      setBusyAction(null);
    }
  }, [allCategories, busyAction, canDeleteCategories, clearActionError, loadCategories]);

  const pageBusy = busyAction !== null;
  const deleteBusyCategoryId = busyAction?.kind === "delete" ? busyAction.categoryId : null;
  const isChildrenView = selectedParentId !== null;
  const title = isChildrenView ? (parentCategory?.name ?? "Category") : "Categories";
  const tableLabel = isChildrenView ? "Subcategories list" : "Categories list";
  const createLabel = isChildrenView ? "Add Subcategory" : "Add Category";
  const emptyMessage = isChildrenView ? "No subcategories match the current filters." : "No categories match the current filters.";
  const footerLabel = isChildrenView ? "Direct subcategories" : "Top-level categories";
  const openCategory = (category: CategoryRecord) => {
    setSelectedParentId(category.id);
  };
  const showTrackingColumn = isChildrenView;

  useEffect(() => {
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
  }, [selectedParentId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextPath = selectedParentId == null ? "/categories" : `/categories/${selectedParentId}`;
    if (window.location.pathname !== nextPath) {
      window.history.replaceState(window.history.state, "", nextPath);
    }
  }, [selectedParentId]);

  const goUpOneCategory = useCallback(() => {
    if (parentCategory?.parent_category != null) {
      setSelectedParentId(parentCategory.parent_category);
    } else {
      setSelectedParentId(null);
    }
  }, [parentCategory]);

  const noun = isChildrenView ? "subcategory" : "category";
  const nounPlural = isChildrenView ? "subcategories" : "categories";
  const totalCategories = filteredCategories.length;
  const summaryText =
    totalCategories === 0
      ? `No ${nounPlural}`
      : totalCategories === 1
        ? `1 ${noun}`
        : pageStart === 1 && pageEnd === totalCategories
          ? `All ${totalCategories} ${nounPlural}`
          : `Showing ${pageStart}–${pageEnd} of ${totalCategories} ${nounPlural}`;

  return (
    <div data-density={density}>
      <Topbar breadcrumb={isChildrenView ? ["Inventory", "Categories", parentCategory?.name ?? "Details"] : ["Inventory", "Categories"]} />

      <div className="page">
        {fetchError && (
          <div style={{ padding: "12px 16px", background: "var(--danger-weak)", border: "1px solid color-mix(in oklch, var(--danger) 30%, transparent)", borderRadius: "var(--radius)", color: "var(--danger)", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span>{fetchError}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <Button type="button" variant="outline" size="xs" onClick={() => loadCategories()}>
                Retry
              </Button>
              <Button type="button" variant="ghost" size="xs" onClick={clearFetchError}>
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {actionError && (
          <div style={{ padding: "12px 16px", background: "var(--danger-weak)", border: "1px solid color-mix(in oklch, var(--danger) 30%, transparent)", borderRadius: "var(--radius)", color: "var(--danger)", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span>{actionError}</span>
            <Button type="button" variant="ghost" size="xs" onClick={clearActionError}>
              Dismiss
            </Button>
          </div>
        )}

        <div className="page-head">
          <div className="page-title-group">
            <h1>{title}</h1>
          </div>
          <div className="page-head-actions">
            {isChildrenView ? (
              <>
                <Button type="button" variant="outline" size="sm" className="page-head-back" onClick={goUpOneCategory}>
                  <Ic d="M19 12H5M12 19l-7-7 7-7" size={12} />
                  {parentCategory?.parent_category != null ? "Up one level" : "Back to Categories"}
                </Button>
                {parentCategory?.parent_category != null && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedParentId(null)}>
                    All categories
                  </Button>
                )}
              </>
            ) : null}
          </div>
        </div>

        <div className="filter-bar">
          <div className="filter-bar-left">
            <label className="search-input">
              <Ic d={<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>} size={14} />
              <input
                placeholder="Search by name, code, parent, or type…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onClick={e => { if (!e.currentTarget.value) e.currentTarget.setSelectionRange(0, 0); }}
                onFocus={e => { if (!e.currentTarget.value) e.currentTarget.setSelectionRange(0, 0); }}
              />
              {search && <button type="button" className="clear-search" onClick={e => { e.preventDefault(); setSearch(""); }}>×</button>}
            </label>

            <div className="filter-select-group">
              <div className="chip-filter-label">Type</div>
              <div className="filter-select-wrap">
                <ThemedSelect
                  value={typeFilter}
                  onChange={setTypeFilter}
                  size="compact"
                  ariaLabel="Filter categories by type"
                  options={[
                    { value: "all", label: "All types" },
                    ...typeOptions.map(type => ({ value: type, label: formatLabel(type) })),
                  ]}
                />
              </div>
            </div>

            <div className="filter-select-group">
              <div className="chip-filter-label">Status</div>
              <div className="filter-select-wrap">
                <ThemedSelect
                  value={statusFilter}
                  onChange={setStatusFilter}
                  size="compact"
                  ariaLabel="Filter categories by status"
                  options={[
                    { value: "all", label: "All statuses" },
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Disabled" },
                  ]}
                />
              </div>
            </div>
          </div>

          <div className="filter-bar-right">
            <div className="seg" title="View mode">
              <button type="button" className={"seg-btn icon-only" + (mode === "table" ? " active" : "")} onClick={() => setMode("table")} title="Table">
                <Ic d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" size={14} />
              </button>
              <button type="button" className={"seg-btn icon-only" + (mode === "grid" ? " active" : "")} onClick={() => setMode("grid")} title="Grid">
                <Ic d={<><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></>} size={14} />
              </button>
            </div>
            {canManageCategories && (
              <Button type="button" size="sm" onClick={openCreateModal} disabled={pageBusy || (isChildrenView && !parentCategory)}>
                <Ic d="M12 5v14M5 12h14" size={14} />
                {createLabel}
              </Button>
            )}
          </div>
        </div>

        {mode === "table" ? (
        <div className="table-card">
          <div className="table-card-head">
            <div className="table-card-head-left">
              <div className="eyebrow">{tableLabel}</div>
              <div className="table-count">
                <span className="mono">{filteredCategories.length}</span>
                <span>of</span>
                <span className="mono">{categories.length}</span>
                <span>{isChildrenView ? "subcategories" : "categories"}</span>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", borderTop: "1px solid var(--hairline)" }}>
              Loading categories…
            </div>
          ) : (
            <div className="h-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Type</th>
                    {showTrackingColumn ? <th>Tracking</th> : <th>Tracking Profile</th>}
                    {showTrackingColumn && <th>Parent</th>}
                    <th>Status</th>
                    <th>Updated</th>
                    {!showTrackingColumn && <th className="col-add-sub">Subcategories</th>}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.length === 0 ? (
                    <tr>
                      <td colSpan={isChildrenView ? 7 : 7}>
                        <div style={{ padding: "32px 12px", textAlign: "center", color: "var(--text-2)", fontSize: 13 }}>
                          {emptyMessage}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pagedCategories.map(category => (
                      <CategoryRow
                        key={category.id}
                        category={category}
                        isChildrenView={isChildrenView}
                        childCount={childCountByCategory.get(category.id) ?? 0}
                        childNames={childNamesByCategory.get(category.id) ?? []}
                        trackingSummary={trackingSummaryByCategory.get(category.id) ?? "No subcategories"}
                        canEdit={canManageCategories}
                        canDelete={canDeleteCategories && canDeleteExcludingSubcategories(category)}
                        onOpen={openCategory ? () => openCategory(category) : undefined}
                        onEdit={canManageCategories ? () => openEditModal(category) : undefined}
                        onDelete={canDeleteCategories && canDeleteExcludingSubcategories(category) ? () => handleDelete(category) : undefined}
                        onAddSubcategory={!isChildrenView && canManageCategories ? () => openAddSubcategoryFor(category) : undefined}
                        disabled={isLoading || pageBusy}
                        deleteBusy={deleteBusyCategoryId === category.id}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          <ListPagination
            summary={summaryText}
            page={page}
            totalPages={totalPages}
            onPrev={() => setPage(current => Math.max(1, current - 1))}
            onNext={() => setPage(current => Math.min(totalPages, current + 1))}
          />
        </div>
        ) : filteredCategories.length > 0 ? (
          <div className="users-grid">
            {pagedCategories.map(category => (
              <CategoryCard
                key={category.id}
                category={category}
                childCount={childCountByCategory.get(category.id) ?? 0}
                childNames={childNamesByCategory.get(category.id) ?? []}
                trackingSummary={trackingSummaryByCategory.get(category.id) ?? "No subcategories"}
                canEdit={canManageCategories}
                canDelete={canDeleteCategories && canDeleteExcludingSubcategories(category)}
                pageBusy={pageBusy}
                deleteBusy={deleteBusyCategoryId === category.id}
                onOpen={openCategory ? () => openCategory(category) : undefined}
                onEdit={() => openEditModal(category)}
                onDelete={canDeleteCategories && canDeleteExcludingSubcategories(category) ? () => handleDelete(category) : undefined}
                onAddSubcategory={!isChildrenView && canManageCategories ? () => openAddSubcategoryFor(category) : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="table-card">
            <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
              {emptyMessage}
            </div>
          </div>
        )}
        {mode === "grid" && filteredCategories.length > 0 ? (
          <ListPagination
            summary={summaryText}
            page={page}
            totalPages={totalPages}
            onPrev={() => setPage(current => Math.max(1, current - 1))}
            onNext={() => setPage(current => Math.min(totalPages, current + 1))}
            standalone
          />
        ) : null}

        <CategoryModal
          open={modalOpen}
          mode={editingCategory ? "edit" : "create"}
          category={editingCategory}
          createContext={editingCategory ? "edit" : (isChildrenView || subcategoryParent) ? "child" : "root"}
          lockedParent={editingCategory ? null : (subcategoryParent ?? parentCategory)}
          onClose={() => { closeModal(); setSubcategoryParent(null); }}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
