/**
 * API debug logging - enable by adding ?debug=1 to URL or running:
 *   localStorage.setItem('DEBUG_API', '1')
 * Then refresh the page. Disable with localStorage.removeItem('DEBUG_API')
 */

function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    localStorage.getItem('DEBUG_API') === '1' ||
    sessionStorage.getItem('DEBUG_API') === '1' ||
    window.location.search.includes('debug=1')
  );
}

export function logApiEnv() {
  if (!isDebugEnabled()) return;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasSupabaseKey = !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  console.group('[API Debug] Environment');
  console.log('NEXT_PUBLIC_API_URL:', apiUrl || '(not set - using fallback)');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', hasSupabaseUrl ? '✓ set' : '✗ missing');
  console.log('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY:', hasSupabaseKey ? '✓ set' : '✗ missing');
  console.groupEnd();
}

export function logApiRequest(label: string, url: string, opts?: { hasToken?: boolean }) {
  if (!isDebugEnabled()) return;
  console.log(`[API] ${label}`, url, opts?.hasToken !== undefined ? (opts.hasToken ? '(with auth)' : '(no token)') : '');
}

/** Logs the error and returns the parsed body (for callers that need it) */
export async function logApiError(
  label: string,
  url: string,
  response: Response,
  opts?: { hasToken?: boolean }
): Promise<unknown> {
  const body = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = body;
  }
  // Always log errors verbosely so you can debug 401/500
  console.group(`[API Error] ${label}`);
  console.log('URL:', url);
  console.log('Status:', response.status, response.statusText);
  console.log('Has token:', opts?.hasToken);
  console.log('Response body:', parsed);
  if (!isDebugEnabled()) {
    console.log('Tip: Add ?debug=1 to the URL or run localStorage.setItem("DEBUG_API","1") and refresh to see env vars');
  }
  console.groupEnd();
  return parsed;
}

export function logApiMessage(label: string, ...args: unknown[]) {
  if (isDebugEnabled()) {
    console.log(`[API] ${label}`, ...args);
  }
}
