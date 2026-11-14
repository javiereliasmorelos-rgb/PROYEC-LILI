const SESSION_TOKEN_KEY = 'inventpro_session_token';
const CSRF_TOKEN_KEY = 'inventpro_csrf_token';

let authTokenMemory = '';
let csrfTokenMemory = '';

function safeSessionGet(key: string): string {
  try {
    return window.sessionStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function safeSessionSet(key: string, value: string) {
  try {
    if (value) {
      window.sessionStorage.setItem(key, value);
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // ignore storage errors in restricted contexts
  }
}

export function setAuthSession(token: string, csrfToken: string) {
  authTokenMemory = token;
  csrfTokenMemory = csrfToken;
  safeSessionSet(SESSION_TOKEN_KEY, token);
  safeSessionSet(CSRF_TOKEN_KEY, csrfToken);
}

export function setCsrfToken(token: string) {
  csrfTokenMemory = token;
  safeSessionSet(CSRF_TOKEN_KEY, token);
}

export function clearAuthSession() {
  authTokenMemory = '';
  csrfTokenMemory = '';
  safeSessionSet(SESSION_TOKEN_KEY, '');
  safeSessionSet(CSRF_TOKEN_KEY, '');
}

function getCookie(name: string): string {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : '';
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const sessionToken = authTokenMemory || safeSessionGet(SESSION_TOKEN_KEY);
  if (sessionToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${sessionToken}`);
  }

  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const token = csrfTokenMemory || safeSessionGet(CSRF_TOKEN_KEY) || getCookie('inventpro_csrf');
    if (token) {
      headers.set('X-CSRF-Token', token);
    }
  }

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : null;

  if (!response.ok) {
    const message =
      (data && typeof data.error === 'string' && data.error) ||
      'No fue posible completar la operación';
    throw new ApiError(message, response.status);
  }

  return data as T;
}

export function formatCurrency(value: number | string | null | undefined): string {
  const num = Number(value ?? 0);
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isNaN(num) ? 0 : num);
}

export function formatNumber(value: number | string | null | undefined): string {
  const num = Number(value ?? 0);
  return new Intl.NumberFormat('es-CO').format(Number.isNaN(num) ? 0 : num);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(d);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
