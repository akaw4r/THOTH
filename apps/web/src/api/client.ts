import type { MeResponse } from '@thoth/shared';

/**
 * HTTP client with automatic CSRF. The token comes from /api/auth/me and is sent
 * in the X-CSRF-Token header on every state-changing request.
 */
let csrfToken = '';

export function setCsrfToken(token: string): void {
  csrfToken = token;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

async function parse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && method !== 'HEAD') headers['X-CSRF-Token'] = csrfToken;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  });

  if (!res.ok) {
    const parsed = (await parse(res)) as { message?: string; error?: string } | null;
    // MFA required on first access: valid session but no enrollment —
    // send the tab to the setup screen instead of showing stray errors.
    if (
      res.status === 403 &&
      parsed &&
      typeof parsed === 'object' &&
      parsed.error === 'mfa_enrollment_required' &&
      !window.location.pathname.startsWith('/mfa-setup')
    ) {
      window.location.assign('/mfa-setup');
    }
    const message =
      (parsed && typeof parsed === 'object' && parsed.message) || `Error ${res.status}`;
    throw new ApiError(res.status, String(message), parsed);
  }
  return (await parse(res)) as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),

  async me(): Promise<MeResponse> {
    const me = await request<MeResponse>('GET', '/auth/me');
    setCsrfToken(me.csrfToken);
    return me;
  },

  async uploadAttachment(projectId: string, file: File, findingId?: string) {
    const form = new FormData();
    form.append('file', file);
    const qs = findingId ? `?findingId=${findingId}` : '';
    return request('POST', `/projects/${projectId}/attachments${qs}`, form);
  },

  download(path: string): void {
    window.open(`/api${path}`, '_blank');
  },
};
