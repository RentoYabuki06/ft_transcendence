// E2E: 2ユーザーでマッチメイキング → ゲーム開始 → スコア決着
import WebSocket from 'ws';

const API = 'http://localhost:3000';
const WS = 'ws://localhost:3000';

async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login failed ${email}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function joinMatchmaking(token) {
  const res = await fetch(`${API}/matchmaking/join`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`join failed: ${await res.text()}`);
}

function openWs(path, token, onMessage) {
  const ws = new WebSocket(`${WS}${path}?token=${token}`);
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    onMessage(msg, ws);
  });
  ws.on('error', (e) => console.error(`[${path}] WS error:`, e.message));
  return ws;
}

function waitFor(predicate, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const t = setInterval(() => {
      const v = predicate();
      if (v !== undefined && v !== null && v !== false) {
        clearInterval(t);
        resolve(v);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(t);
        reject(new Error('timeout'));
      }
    }, 50);
  });
}

async function main() {
  console.log('--- Login both users ---');
  const u1 = await login('test@test.com', 'password123');
  const u2 = await login('p2@test.com', 'password123');
  console.log('u1:', u1.user.nickname, 'u2:', u2.user.nickname);

  console.log('--- Open matchmaking WS for both ---');
  let gameId1 = null, gameId2 = null, opp1 = null, opp2 = null;

  const mm1 = openWs('/ws/matchmaking', u1.token, (m) => {
    if (m.type === 'matched') { gameId1 = m.gameId; opp1 = m.opponent; }
  });
  const mm2 = openWs('/ws/matchmaking', u2.token, (m) => {
    if (m.type === 'matched') { gameId2 = m.gameId; opp2 = m.opponent; }
  });

  await new Promise((r) => setTimeout(r, 300));

  console.log('--- Both call /matchmaking/join ---');
  await joinMatchmaking(u1.token);
  await joinMatchmaking(u2.token);

  console.log('--- Wait for matched event ---');
  await waitFor(() => gameId1 && gameId2, 8000);
  console.log(`Match found: game=${gameId1}, u1 opp=${opp1.nickname}, u2 opp=${opp2.nickname}`);

  if (gameId1 !== gameId2) throw new Error('gameId mismatch');

  mm1.close();
  mm2.close();

  console.log('--- Open game WS for both ---');
  let u1Started = false, u2Started = false, u1Finished = false, u2Finished = false;
  let finishedWinnerId = null;

  const gws1 = openWs(`/ws/game/${gameId1}`, u1.token, (m) => {
    if (m.type === 'game_start') u1Started = true;
    if (m.type === 'game_finished') { u1Finished = true; finishedWinnerId = m.winnerId; }
  });
  const gws2 = openWs(`/ws/game/${gameId1}`, u2.token, (m) => {
    if (m.type === 'game_start') u2Started = true;
    if (m.type === 'game_finished') u2Finished = true;
  });

  await waitFor(() => u1Started && u2Started, 5000);
  console.log('Both received game_start');

  console.log('--- User1 simulates winning (sends game_over) ---');
  gws1.send(JSON.stringify({ type: 'game_over', winnerId: u1.user.id, myScore: 5, opponentScore: 3 }));

  await waitFor(() => u1Finished && u2Finished, 5000);
  console.log(`Both received game_finished, winnerId=${finishedWinnerId}`);

  gws1.close();
  gws2.close();

  await new Promise((r) => setTimeout(r, 300));

  console.log('--- Verify DB: game state & scores ---');
  const histRes = await fetch(`${API}/games/history?limit=1`, {
    headers: { Authorization: `Bearer ${u1.token}` },
  });
  const hist = await histRes.json();
  console.log('u1 latest match:', JSON.stringify(hist.data[0]));

  console.log('--- E2E PASSED ✓ ---');
  process.exit(0);
}

main().catch((e) => {
  console.error('E2E FAILED:', e);
  process.exit(1);
});
