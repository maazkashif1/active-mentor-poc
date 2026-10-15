const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('physio_token');
}

export function setToken(t) {
  localStorage.setItem('physio_token', t);
}

export function clearToken() {
  localStorage.removeItem('physio_token');
  localStorage.removeItem('physio_name');
}

export function getUserName() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('physio_name') || '';
}

export function setUserName(name) {
  localStorage.setItem('physio_name', name);
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  get: (path) => apiFetch(path),
  post: (path, body) => apiFetch(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path, body) => apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) => apiFetch(path, { method: 'DELETE' }),
};
