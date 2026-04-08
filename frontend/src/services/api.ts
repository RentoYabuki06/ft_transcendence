const API_BASE = '/api';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem('auth_token');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ token: string; user: import('../types').User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  signup: (data: { nickname: string; email: string; password: string }) =>
    request<{ token: string; user: import('../types').User }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logout: () =>
    request<void>('/auth/logout', { method: 'POST' }),

  oauth42Login: () => {
    window.location.href = `${API_BASE}/auth/42`;
  },

  // Users
  getMe: () =>
    request<import('../types').User>('/users/me'),

  updateMe: (data: Partial<import('../types').User>) =>
    request<import('../types').User>('/users/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return request<{ avatarUrl: string }>('/users/me/avatar', {
      method: 'POST',
      body: formData,
      headers: {}, // Let browser set content-type for FormData
    });
  },

  getUser: (id: number) =>
    request<import('../types').User>(`/users/${id}`),

  getFriends: () =>
    request<import('../types').Friend[]>('/users/me/friends'),

  addFriend: (userId: number) =>
    request<void>(`/users/me/friends/${userId}`, { method: 'POST' }),

  removeFriend: (userId: number) =>
    request<void>(`/users/me/friends/${userId}`, { method: 'DELETE' }),

  // Games & Matching
  getMatchHistory: (params?: { page?: number; limit?: number; sort?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.sort) query.set('sort', params.sort);
    return request<{ data: import('../types').MatchHistoryEntry[]; total: number; page: number; limit: number }>(
      `/games/history?${query.toString()}`
    );
  },

  getRanking: (params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return request<{ data: import('../types').RankingEntry[]; total: number }>(
      `/ranking?${query.toString()}`
    );
  },

  // Matchmaking
  joinMatchmaking: () =>
    request<{ waitingRoomId: number }>('/matchmaking/join', { method: 'POST' }),

  cancelMatchmaking: () =>
    request<void>('/matchmaking/cancel', { method: 'POST' }),
};
