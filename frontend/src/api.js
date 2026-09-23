const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export const PAGE_SIZES = [10, 25, 50];

/**
 * Fetches a chunk of leads from the backend.
 * @param {{ page?: number, limit?: number, search?: string, signal?: AbortSignal }} options
 * @returns {Promise<{ data: Array<Object>, total: number, page: number, limit: number }>}
 */
export async function fetchLeads({ page = 1, limit = PAGE_SIZES[0], search = '', signal } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);

  const res = await fetch(`${API_BASE}/api/leads?${params.toString()}`, { signal });

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      // response body was not JSON — keep the generic message
    }
    throw new Error(message);
  }

  const body = await res.json();
  return {
    data: Array.isArray(body.data) ? body.data : [],
    total: body.total ?? 0,
    page: body.page ?? page,
    limit: body.limit ?? limit,
  };
}
