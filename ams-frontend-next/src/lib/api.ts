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
export function friendlyMessage(raw: string): string {
  if (!raw) return raw;
  const msg = raw.trim();
  const lower = msg.toLowerCase();

  // Common Django / DRF / database patterns
  if (lower.includes("duplicate key value") || lower.includes("already exists")) {
    return "This value is already in use. Please choose a different one.";
  }
  if (lower.includes("csrf")) {
    return "Your session has expired. Please refresh the page and try again.";
  }
  if (lower.includes("authentication credentials were not provided")) {
    return "You need to sign in to perform this action.";
  }
  if (lower.includes("permission") && lower.includes("denied")) {
    return "You do not have permission to perform this action.";
  }
  if (lower.includes("integrityerror") || lower.includes("foreign key") || lower.includes("constraint failed")) {
    return "This record is linked to other data and cannot be changed or removed in this way.";
  }
  if (lower.includes("not found") || lower === "404" || lower.includes("does not exist")) {
    return "The requested record was not found. It may have been removed.";
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
  if (lower.includes("this field is required") || lower.includes("may not be blank") || lower.includes("may not be null")) {
    return "This field is required.";
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
    message: globalErrors.length > 0 ? globalErrors.join(" ") : null,
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
