const API_BASE = '/api';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem('auth_token');

  const hasBody = options.body !== undefined && options.body !== null;
  const headers: HeadersInit = {
    ...(hasBody && !(options.body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : {}),
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
    request<
      | { token: string; user: import('../types').User }
      | { requires2fa: true; tempToken: string }
    >('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  login2faChallenge: (tempToken: string, code: string) =>
    request<{ token: string; user: import('../types').User }>('/auth/2fa/challenge', {
      method: 'POST',
      body: JSON.stringify({ tempToken, code }),
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

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string }>('/users/me/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  // 2FA
  setup2FA: () =>
    request<{ secret: string; qrCodeUrl: string }>('/users/me/2fa/setup', { method: 'POST' }),

  verify2FA: (code: string) =>
    request<{ message: string }>('/users/me/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  disable2FA: () =>
    request<{ message: string }>('/users/me/2fa', { method: 'DELETE' }),

  // GDPR
  exportMyData: async () => {
    const token = sessionStorage.getItem('auth_token');
    const res = await fetch(`${API_BASE}/users/me/export`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-data.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  deleteMyAccount: () =>
    request<{ message: string }>('/users/me', { method: 'DELETE' }),

  // Blocks
  getBlocks: () =>
    request<Array<{ id: number; nickname: string; avatarUrl: string | null; blockedAt: string }>>(
      '/users/me/blocks'
    ),

  blockUser: (userId: number) =>
    request<{ message: string }>(`/users/me/blocks/${userId}`, { method: 'POST' }),

  unblockUser: (userId: number) =>
    request<{ message: string }>(`/users/me/blocks/${userId}`, { method: 'DELETE' }),

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

  // User search (for adding friends)
  searchUsers: (q: string) =>
    request<Array<{ id: number; nickname: string; avatarUrl: string | null }>>(
      `/users?search=${encodeURIComponent(q)}`
    ),

  // Chat
  getConversations: () =>
    request<Array<{
      partnerId: number;
      nickname: string;
      avatarUrl: string | null;
      lastMessage: { body: string; createdAt: string; fromMe: boolean };
      unreadCount: number;
    }>>('/messages/conversations'),

  getMessages: (userId: number) =>
    request<Array<{
      id: number;
      senderId: number;
      receiverId: number;
      body: string;
      createdAt: string;
      readAt: string | null;
    }>>(`/messages/${userId}`),

  sendMessage: (receiverId: number, body: string) =>
    request<{ id: number; senderId: number; receiverId: number; body: string; createdAt: string }>(
      '/messages',
      { method: 'POST', body: JSON.stringify({ receiverId, body }) }
    ),

  // Tournaments
  getTournaments: () =>
    request<Array<{
      id: number;
      name: string;
      createdBy: number;
      maxParticipants: number;
      participantCount: number;
      status: { id: number; name: string } | null;
      createdAt: string;
    }>>('/tournaments'),

  createTournament: (name: string, maxParticipants: 4 | 8) =>
    request<{ id: number; name: string; maxParticipants: number; createdAt: string }>(
      '/tournaments',
      { method: 'POST', body: JSON.stringify({ name, maxParticipants }) }
    ),

  getTournament: (id: number) =>
    request<{
      id: number;
      name: string;
      createdBy: number;
      maxParticipants: number;
      status: { id: number; name: string } | null;
      participants: Array<{ id: number; userId: number; alias: string; nickname?: string; avatarUrl?: string | null }>;
      bracket: Array<{
        id: number;
        round: number;
        order: number;
        status?: string;
        winnerId: number | null;
        players: Array<{ userId: number; nickname?: string; score: number | null; isWinner: boolean | null }>;
      }>;
      createdAt: string;
      updatedAt: string;
    }>(`/tournaments/${id}`),

  joinTournament: (id: number, alias?: string) =>
    request<{ message: string }>(`/tournaments/${id}/join`, {
      method: 'POST',
      body: JSON.stringify({ alias }),
    }),

  startTournament: (id: number) =>
    request<{ message: string; tournamentId: number }>(`/tournaments/${id}/start`, { method: 'POST' }),
};
