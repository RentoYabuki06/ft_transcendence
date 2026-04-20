// E2E: Tournament create → join (4) → start → play all rounds → winner
const API = 'http://localhost:3000'

async function req(path, opts = {}, token) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${path}: ${res.status} ${text}`)
  return text ? JSON.parse(text) : null
}

async function ensureUser(email, password, nickname) {
  try {
    const r = await req('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    if ('token' in r) return r
  } catch {}
  const r = await req('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, nickname }) })
  return r
}

async function main() {
  console.log('--- Ensure 4 users ---')
  const u1 = await ensureUser('test@test.com', 'password123', 'testuser')
  const u2 = await ensureUser('p2@test.com', 'password123', 'player2')
  const u3 = await ensureUser('p3@test.com', 'password123', 'player3')
  const u4 = await ensureUser('p4@test.com', 'password123', 'player4')
  const users = [u1, u2, u3, u4]
  console.log('Users ready:', users.map(u => u.user.nickname).join(', '))

  console.log('--- u1 creates tournament ---')
  const t = await req('/tournaments', {
    method: 'POST',
    body: JSON.stringify({ name: 'E2E Cup ' + Date.now(), maxParticipants: 4 }),
  }, u1.token)
  console.log('Tournament id:', t.id)

  console.log('--- u2,u3,u4 join ---')
  for (const u of [u2, u3, u4]) {
    await req(`/tournaments/${t.id}/join`, { method: 'POST', body: JSON.stringify({}) }, u.token)
  }

  console.log('--- u1 starts ---')
  await req(`/tournaments/${t.id}/start`, { method: 'POST' }, u1.token)

  let detail = await req(`/tournaments/${t.id}`, {}, u1.token)
  if (detail.bracket.length !== 2) throw new Error(`expected 2 r1 games, got ${detail.bracket.length}`)
  console.log('Bracket R1: 2 games ✓')

  console.log('--- Submit results for R1 games ---')
  for (const g of detail.bracket) {
    const [p1, p2] = g.players
    await req(`/tournaments/${t.id}/games/${g.id}/result`, {
      method: 'POST',
      body: JSON.stringify({ scores: [{ userId: p1.userId, score: 5 }, { userId: p2.userId, score: 2 }] }),
    }, u1.token)
  }

  detail = await req(`/tournaments/${t.id}`, {}, u1.token)
  const r2 = detail.bracket.filter(g => g.round === 2)
  if (r2.length !== 1) throw new Error(`expected 1 r2 (final), got ${r2.length}`)
  console.log('Final generated ✓')

  console.log('--- Submit final result ---')
  const finalG = r2[0]
  const [fp1, fp2] = finalG.players
  await req(`/tournaments/${t.id}/games/${finalG.id}/result`, {
    method: 'POST',
    body: JSON.stringify({ scores: [{ userId: fp1.userId, score: 7 }, { userId: fp2.userId, score: 3 }] }),
  }, u1.token)

  detail = await req(`/tournaments/${t.id}`, {}, u1.token)
  if (detail.status?.name !== 'finished') throw new Error(`tournament not finished: ${detail.status?.name}`)
  console.log('Tournament finished ✓ winner userId=', fp1.userId)

  console.log('--- E2E Tournament PASSED ✓ ---')
  process.exit(0)
}

main().catch((e) => {
  console.error('E2E Tournament FAILED:', e.message)
  process.exit(1)
})
