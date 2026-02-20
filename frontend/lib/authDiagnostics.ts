export type AuthFailureReason =
  | 'missing_token'
  | 'refresh_failed'
  | 'retry_401_after_refresh'
  | 'forbidden_403'
  | 'unauthorized_401'
  | 'other';

type LogLevel = 'log' | 'warn' | 'error';

interface AuthEventContext {
  method: string;
  path: string;
  requestId?: string;
  status?: number;
  retryStatus?: number;
  refreshAttempted?: boolean;
  refreshSucceeded?: boolean;
  reason?: AuthFailureReason;
  detail?: string;
}

interface AnomalyState {
  retry401AfterRefreshTimestamps: number[];
  misconfigAlertedAt?: number;
}

const STORAGE_KEY = 'dots_auth_diag_v1';
const MISCONFIG_WINDOW_MS = 5 * 60 * 1000;
const MISCONFIG_THRESHOLD = 3;

let state: AnomalyState = {
  retry401AfterRefreshTimestamps: [],
};

function persistState() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures in private mode or restricted environments.
  }
}

function loadState() {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as AnomalyState;
    if (Array.isArray(parsed.retry401AfterRefreshTimestamps)) {
      state = {
        retry401AfterRefreshTimestamps: parsed.retry401AfterRefreshTimestamps,
        misconfigAlertedAt: parsed.misconfigAlertedAt,
      };
    }
  } catch {
    // Ignore malformed payloads.
  }
}

function normalizeStateWindow(nowMs: number) {
  state.retry401AfterRefreshTimestamps = state.retry401AfterRefreshTimestamps.filter(
    (ts) => nowMs - ts <= MISCONFIG_WINDOW_MS
  );
}

function emit(level: LogLevel, event: string, context: AuthEventContext) {
  const payload = {
    event,
    method: context.method,
    path: context.path,
    requestId: context.requestId,
    status: context.status,
    retryStatus: context.retryStatus,
    refreshAttempted: context.refreshAttempted,
    refreshSucceeded: context.refreshSucceeded,
    reason: context.reason,
    detail: context.detail,
    timestamp: new Date().toISOString(),
  };

  if (level === 'error') {
    console.error('[AuthDiag]', payload);
  } else if (level === 'warn') {
    console.warn('[AuthDiag]', payload);
  } else {
    console.log('[AuthDiag]', payload);
  }
}

export function createAuthRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `auth-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function classifyAuthFailure(params: {
  status?: number;
  retryStatus?: number;
  hasToken?: boolean;
  refreshAttempted?: boolean;
  refreshSucceeded?: boolean;
}): AuthFailureReason {
  if (!params.hasToken) return 'missing_token';
  if (params.status === 403 || params.retryStatus === 403) return 'forbidden_403';
  if (params.refreshAttempted && params.refreshSucceeded === false) return 'refresh_failed';
  if (params.refreshAttempted && params.retryStatus === 401) return 'retry_401_after_refresh';
  if (params.status === 401 || params.retryStatus === 401) return 'unauthorized_401';
  return 'other';
}

export function logAuthEvent(level: LogLevel, event: string, context: AuthEventContext) {
  emit(level, event, context);
}

export function recordAuthFailure(context: AuthEventContext) {
  if (typeof window === 'undefined') return;

  if (state.retry401AfterRefreshTimestamps.length === 0) {
    loadState();
  }

  const nowMs = Date.now();
  normalizeStateWindow(nowMs);

  if (context.reason === 'retry_401_after_refresh') {
    state.retry401AfterRefreshTimestamps.push(nowMs);
    persistState();

    if (
      state.retry401AfterRefreshTimestamps.length >= MISCONFIG_THRESHOLD &&
      (!state.misconfigAlertedAt || nowMs - state.misconfigAlertedAt > MISCONFIG_WINDOW_MS)
    ) {
      state.misconfigAlertedAt = nowMs;
      persistState();
      emit('error', 'AUTH_MISCONFIG_SUSPECTED', {
        ...context,
        detail: `Repeated 401 after refresh (${state.retry401AfterRefreshTimestamps.length} in 5 minutes)`,
      });
    }
  }
}
