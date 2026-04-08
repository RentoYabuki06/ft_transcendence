import { http, HttpResponse, delay } from 'msw';
import { mockUsers, currentUser, mockMatchHistory, mockRanking, mockFriends, mockAchievements } from './data';

export const handlers = [
  // Auth
  http.post('/api/auth/login', async ({ request }) => {
    await delay(500);
    const body = await request.json() as { email: string; password: string };
    const user = mockUsers.find((u) => u.email === body.email);
    if (!user) {
      return HttpResponse.json({ message: 'メールアドレスまたはパスワードが正しくありません' }, { status: 401 });
    }
    return HttpResponse.json({ token: 'mock-jwt-token-' + user.id, user });
  }),

  http.post('/api/auth/signup', async ({ request }) => {
    await delay(500);
    const body = await request.json() as { nickname: string; email: string; password: string };
    const existing = mockUsers.find((u) => u.email === body.email);
    if (existing) {
      return HttpResponse.json({ message: 'このメールアドレスは既に使用されています' }, { status: 409 });
    }
    const newUser = {
      ...currentUser,
      id: mockUsers.length + 1,
      nickname: body.nickname,
      email: body.email,
      wins: 0,
      losses: 0,
      rank: mockUsers.length + 1,
      level: 1,
    };
    return HttpResponse.json({ token: 'mock-jwt-token-new', user: newUser });
  }),

  http.post('/api/auth/logout', async () => {
    await delay(200);
    return HttpResponse.json(null, { status: 200 });
  }),

  // Users
  http.get('/api/users/me', async () => {
    await delay(300);
    return HttpResponse.json(currentUser);
  }),

  http.put('/api/users/me', async ({ request }) => {
    await delay(400);
    const body = await request.json() as Partial<typeof currentUser>;
    const updated = { ...currentUser, ...body, updatedAt: new Date().toISOString() };
    return HttpResponse.json(updated);
  }),

  http.post('/api/users/me/avatar', async () => {
    await delay(600);
    return HttpResponse.json({ avatarUrl: '/mock-avatar.png' });
  }),

  http.get('/api/users/:id', async ({ params }) => {
    await delay(300);
    const user = mockUsers.find((u) => u.id === Number(params.id));
    if (!user) {
      return HttpResponse.json({ message: 'ユーザーが見つかりません' }, { status: 404 });
    }
    return HttpResponse.json(user);
  }),

  // Friends
  http.get('/api/users/me/friends', async () => {
    await delay(300);
    return HttpResponse.json(mockFriends);
  }),

  http.post('/api/users/me/friends/:userId', async () => {
    await delay(300);
    return HttpResponse.json(null, { status: 201 });
  }),

  http.delete('/api/users/me/friends/:userId', async () => {
    await delay(300);
    return HttpResponse.json(null, { status: 200 });
  }),

  // Match History
  http.get('/api/games/history', async ({ request }) => {
    await delay(400);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const sort = url.searchParams.get('sort') || 'date_desc';

    let sorted = [...mockMatchHistory];
    if (sort === 'date_asc') sorted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    else sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const start = (page - 1) * limit;
    const data = sorted.slice(start, start + limit);

    return HttpResponse.json({ data, total: mockMatchHistory.length, page, limit });
  }),

  // Ranking
  http.get('/api/ranking', async ({ request }) => {
    await delay(400);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    const start = (page - 1) * limit;
    const data = mockRanking.slice(start, start + limit);

    return HttpResponse.json({ data, total: mockRanking.length });
  }),

  // Matchmaking
  http.post('/api/matchmaking/join', async () => {
    await delay(1000);
    return HttpResponse.json({ waitingRoomId: 1 });
  }),

  http.post('/api/matchmaking/cancel', async () => {
    await delay(300);
    return HttpResponse.json(null, { status: 200 });
  }),

  // Achievements
  http.get('/api/users/me/achievements', async () => {
    await delay(300);
    return HttpResponse.json(mockAchievements);
  }),

  // Game result
  http.get('/api/games/:id', async ({ params }) => {
    await delay(300);
    return HttpResponse.json({
      id: Number(params.id),
      tournamentId: null,
      gameTypeId: 1,
      statusId: 3,
      status: { id: 3, name: 'finished', entityType: 'game' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      players: [
        { id: 1, gameId: Number(params.id), userId: 1, user: { id: 1, nickname: 'SpacePilot', avatarUrl: null }, score: 11, isWinner: true },
        { id: 2, gameId: Number(params.id), userId: 2, user: { id: 2, nickname: 'NebulaStar', avatarUrl: null }, score: 7, isWinner: false },
      ],
    });
  }),
];
