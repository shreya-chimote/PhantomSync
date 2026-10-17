const API_BASE = '/api';

/**
 * Robust fetch wrapper that gracefully reports network errors for offline detection
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => ({}));

    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (networkError) {
    // Network failure (offline, connection refused, timeout)
    return {
      ok: false,
      status: 0,
      networkError: true,
      error: networkError.message || 'Network unreachable',
    };
  }
}

export const api = {
  // Health
  checkHealth: () => request('/health'),

  // Notes CRUD
  getNotes: (since, includeDeleted = false) => {
    const params = new URLSearchParams();
    if (since) params.append('since', since);
    if (includeDeleted) params.append('includeDeleted', 'true');
    const query = params.toString() ? `?${params.toString()}` : '';
    return request(`/notes${query}`);
  },

  getNoteById: (id) => request(`/notes/${id}`),

  createNote: (note) =>
    request('/notes', {
      method: 'POST',
      body: JSON.stringify(note),
    }),

  updateNote: (id, noteData) =>
    request(`/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(noteData),
    }),

  deleteNote: (id, clientId) =>
    request(`/notes/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ clientId }),
    }),

  // Batch Sync
  syncBatch: (batchPayload) =>
    request('/sync/batch', {
      method: 'POST',
      body: JSON.stringify(batchPayload),
    }),

  // History & Restore
  getHistory: (noteId) => request(`/notes/${noteId}/history`),

  restoreVersion: (noteId, targetVersion, clientId) =>
    request(`/notes/${noteId}/restore`, {
      method: 'POST',
      body: JSON.stringify({ targetVersion, clientId }),
    }),

  // AI Merge Suggestion
  suggestAIMerge: (baseNote, remoteNote, localNote) =>
    request('/ai/suggest-merge', {
      method: 'POST',
      body: JSON.stringify({ baseNote, remoteNote, localNote }),
    }),
};
