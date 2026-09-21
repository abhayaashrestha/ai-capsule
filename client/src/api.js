async function request(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (res.status === 401) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }

  return res.json();
}

export const getMe = () => request('/api/me');
export const listCapsules = () => request('/api/capsules');
export const createCapsule = (data) =>
  request('/api/capsules', { method: 'POST', body: JSON.stringify(data) });
export const updateCapsule = (id, data) =>
  request(`/api/capsules/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteCapsule = (id) =>
  request(`/api/capsules/${id}`, { method: 'DELETE' });
export const logout = () => request('/auth/logout', { method: 'POST' });
