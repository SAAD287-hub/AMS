export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type ApiErrorDetails = {
  message: string | null;
  fieldErrors: Record<string, string>;
  globalErrors: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map(item => item.trim());
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return [];
}

function joinPath(parent: string, key: string) {
  return parent ? `${parent}.${key}` : key;
}

function collectFieldErrors(
  value: unknown,
  path: string,
  errors: Record<string, string>,
) {
  const primitiveMessages = stringList(value);
  if (path && primitiveMessages.length > 0) {
    errors[path] = primitiveMessages.join(" ");
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectFieldErrors(item, joinPath(path, String(index)), errors);
    });
    return;
  }

  if (!isRecord(value)) return;

  Object.entries(value).forEach(([key, entry]) => {
    if (key === "detail" || key === "non_field_errors" || key === "delete_blockers") return;
    collectFieldErrors(entry, joinPath(path, key), errors);
  });
}

// Converts technical / backend error strings into friendlier end-user phrasing.
// Only rewrites patterns we know are confusing; otherwise returns the input as-is.
// Order matters: more specific checks go first so a generic branch doesn't
// pre-empt them.
export function friendlyMessage(raw: string): string {
  if (!raw) return raw;
  const msg = raw.trim();
  const lower = msg.toLowerCase();

  // --- unique_together variants (specific pairs before the generic fallback) ---
  if (
    lower.includes("must make a unique set") &&
    lower.includes("parent_category") &&
    lower.includes("name")
  ) {
    return "A subcategory with this name already exists under this parent. Please contact an administrator if you need another one.";
  }
  if (
    lower.includes("must make a unique set") &&
    lower.includes("item") &&
    lower.includes("batch_number")
  ) {
    return "A batch or lot with this number already exists for this item. Please enter a different batch number.";
  }
  if (
    lower.includes("must make a unique set") &&
    lower.includes("register_number") &&
    lower.includes("store")
  ) {
    return "A stock register with this number already exists for this store. Please use a different register number.";
  }
  if (
    lower.includes("must make a unique set") &&
    lower.includes("policy") &&
    lower.includes("fiscal_year_start")
  ) {
    return "A depreciation run for this policy and fiscal year already exists.";
  }
  if (lower.includes("must make a unique set")) {
    return "A record with this combination of values already exists.";
  }

  // --- auth-specific (match BEFORE the generic missing-credentials line) ---
  if (lower.includes("no refresh token")) {
    return "Your session has expired. Please sign in again.";
  }
  if (
    lower.includes("unable to log in with provided credentials") ||
    lower.includes("no active account found") ||
    lower === "invalid credentials." ||
    lower === "invalid credentials"
  ) {
    return "The username or password is incorrect. Please try again.";
  }
  if (
    lower.includes("account disabled") ||
    lower.includes("account has been disabled") ||
    lower.includes("user account is disabled") ||
    lower.includes("user is inactive")
  ) {
    return "This account is disabled. Please contact an administrator.";
  }
  if (
    lower.includes("token not valid") ||
    lower.includes("given token not valid") ||
    lower.includes("token is invalid or expired")
  ) {
    return "Your session has expired. Please sign in again.";
  }

  if (lower.includes("duplicate key value") || lower.includes("already exists")) {
    return "This value is already in use. Please choose a different one.";
  }
  if (lower.includes("csrf")) {
    return "Your session has expired. Please refresh the page and try again.";
  }
  if (lower.includes("authentication credentials were not provided")) {
    return "You need to sign in to perform this action.";
  }

  // Microphone permission denial — specific case of permission+denied.
  if (
    lower.includes("notallowederror") ||
    (lower.includes("permission denied") && lower.includes("microphone")) ||
    (lower.includes("getusermedia") && lower.includes("denied"))
  ) {
    return "Microphone access is blocked. Please allow microphone permission in your browser and try again.";
  }
  if (lower.includes("permission") && lower.includes("denied")) {
    return "You do not have permission to perform this action. If you think you should, ask an administrator to adjust your role.";
  }

  // Workflow/state-machine errors ("Cannot transition from DRAFT to STOCK_DETAILS").
  if (lower.includes("cannot transition from")) {
    return "This record is not at the right stage for that action. Refresh the page and try again from its current stage.";
  }

  if (lower.includes("request was throttled")) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  // Delete-blocker phrasings that mention internal entity names.
  if (lower.includes("item instances") || lower.includes("item batches")) {
    return "This item still has recorded units or batches, so it cannot be deleted.";
  }
  if (lower.includes("auto-created main store")) {
    return "The main store for this location still has sub-locations. Please move or delete them first.";
  }

  if (lower.includes("integrityerror") || lower.includes("foreign key") || lower.includes("constraint failed")) {
    return "This record is linked to other data and cannot be changed or removed in this way.";
  }
  if (lower.includes("not found") || lower === "404" || lower.includes("does not exist")) {
    return "The requested record was not found. It may have been removed.";
  }

  // Bare browser-level fetch failures (TypeError: Failed to fetch, Safari "Load failed", Firefox NetworkError).
  if (
    lower.includes("failed to fetch") ||
    lower === "load failed" ||
    lower.includes("networkerror when attempting to fetch")
  ) {
    return "Could not reach the server. Please check your connection and try again.";
  }
  if (lower.includes("network") && (lower.includes("fail") || lower.includes("error"))) {
    return "Could not reach the server. Please check your connection and try again.";
  }
  if (lower === "500" || lower.includes("internal server error") || lower.startsWith("http 500")) {
    return "Something went wrong on the server. Please try again or contact support.";
  }
  if (lower.startsWith("http 4")) {
    return "The request was rejected. Please review the form and try again.";
  }

  // --- DRF field-validator chain ---
  if (lower.includes("this field is required") || lower.includes("may not be blank") || lower.includes("may not be null")) {
    return "This field is required.";
  }
  if (lower.includes("is not a valid choice")) {
    return "Please pick one of the allowed options.";
  }
  if (lower.includes("a valid integer is required") || lower.includes("enter a valid integer")) {
    return "Please enter a whole number.";
  }
  if (lower.includes("a valid number is required") || lower.includes("enter a number")) {
    return "Please enter a valid number.";
  }
  if (lower.includes("ensure this value is less than or equal to")) {
    return "This value is too large. Please enter a smaller number.";
  }
  if (lower.includes("ensure this value is greater than or equal to")) {
    return "This value is too small. Please enter a larger number.";
  }
  if (lower.includes("ensure this field has no more than") || lower.includes("ensure this field has at most")) {
    return "This text is too long. Please shorten it.";
  }
  if (lower.includes("ensure this field has at least")) {
    return "This text is too short.";
  }
  if (lower.includes("ensure that there are no more than") && lower.includes("digits")) {
    return "This number has too many digits. Please use fewer decimals.";
  }
  if (lower.includes("no file was submitted") || lower.includes("the submitted data was not a file")) {
    return "Please attach a file.";
  }
  if (lower.includes("upload a valid image") || lower.includes("not an image or a corrupted image")) {
    return "That file is not a valid image. Please upload a JPG or PNG.";
  }
  if (lower.includes("must be a valid uuid") || lower.includes("is not a valid uuid")) {
    return "That identifier is not valid.";
  }
  if (lower.includes("enter a valid url")) {
    return "Please enter a valid web address (starting with http:// or https://).";
  }
  if (lower.includes("expected a list of items")) {
    return "Please provide a list of values.";
  }
  if (lower.includes("date has wrong format") || lower.includes("datetime has wrong format")) {
    return "Please enter a valid date (YYYY-MM-DD).";
  }
  if (lower.includes("invalid date")) {
    return "Please enter a valid date.";
  }
  if (lower.includes("invalid email")) {
    return "Please enter a valid email address.";
  }

  return msg;
}

export function extractApiErrorDetails(body: unknown): ApiErrorDetails {
  const fieldErrors: Record<string, string> = {};
  const globalErrors: string[] = [];

  if (!isRecord(body)) {
    return { message: null, fieldErrors, globalErrors };
  }

  const record = body;

  const deleteBlockerMessages = stringList(record.delete_blockers);
  globalErrors.push(...deleteBlockerMessages);

  if (
    deleteBlockerMessages.length === 0 &&
    typeof record.detail === "string" &&
    record.detail.trim()
  ) {
    globalErrors.push(record.detail.trim());
  }

  globalErrors.push(...stringList(record.non_field_errors));
  collectFieldErrors(record, "", fieldErrors);

  const capitalize = (s: string) => (s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const fieldMessages = Object.entries(fieldErrors)
    .map(([key, value]) => {
      const msg = capitalize(friendlyMessage(String(value).trim()));
      return msg ? `${key}: ${msg}` : "";
    })
    .filter(Boolean);
  const messages = [...globalErrors.map(friendlyMessage).map(capitalize), ...fieldMessages];
  if (fieldMessages.length > 0) {
    return { message: messages.join(" "), fieldErrors, globalErrors };
  }

  return {
    message:
      globalErrors.length > 0
        ? globalErrors.map(friendlyMessage).map(capitalize).join(" ")
        : null,
    fieldErrors,
    globalErrors,
  };
}

function formatApiError(body: unknown): string | null {
  return extractApiErrorDetails(body).message;
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
    this.name = "ApiError";
    Object.defineProperty(this, "message", {
      value: message,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
}

let refreshInFlight: Promise<boolean> | null = null;

export async function csrfHeaders(): Promise<Record<string, string>> {
  const csrf = await fetch(`${API_BASE}/auth/cookie/csrf/`, { credentials: 'include', cache: 'no-store' });
  if (!csrf.ok) throw new ApiError(csrf.status, 'Unable to initialize request security.');
  const { csrfToken } = await csrf.json();
  if (typeof csrfToken !== 'string' || !csrfToken) throw new Error('Missing CSRF token.');
  return { 'X-CSRFToken': csrfToken };
}

export async function apiRequest(path: string, options?: RequestInit): Promise<Response> {
  const headers = new Headers(options?.headers);
  const method = (options?.method ?? 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    // Fetch a masked token from the API origin so separate frontend/backend
    // hosts work without exposing the httpOnly authentication cookies.
    const csrf = await csrfHeaders();
    headers.set('X-CSRFToken', csrf['X-CSRFToken']);
  }
  const send = () => fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });
  const res = await send();
  if (res.status !== 401 || path.startsWith('/auth/cookie/')) return res;
  if (!refreshInFlight) {
    refreshInFlight = apiRequest('/auth/cookie/refresh/', { method: 'POST' })
      .then(response => response.ok).catch(() => false).finally(() => { refreshInFlight = null; });
  }
  return await refreshInFlight ? send() : res;
}

function getTopLoader(): { start(): void; done(): void } | null {
  if (typeof window === 'undefined') return null;
  const loader = (window as unknown as { __topLoader?: { start(): void; done(): void } }).__topLoader;
  return loader ?? null;
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (!(typeof FormData !== 'undefined' && options?.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const loader = getTopLoader();
  loader?.start();
  try {
    const res = await apiRequest(path, { ...options, headers });

    if (!res.ok) {
      let message = friendlyMessage(`HTTP ${res.status}`);
      let body: unknown;
      try {
        body = await res.json();
        message = formatApiError(body) ?? message;
      } catch {
        /* ignore parse error */
      }
      throw new ApiError(res.status, message, body);
    }

    // 204 No Content
    if (res.status === 204) return undefined as T;

    return await res.json();
  } finally {
    loader?.done();
  }
}

/** DRF paginated list wrapper */
export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
