// E2E: Friends add/remove + online status via presence WS
import WebSocket from 'ws'

const API = 'http://localhost:3000'
const WS = 'ws://localhost:3000'

async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(`login: ${res.status}`)
  return res.json()
}

async function req(path, opts, token) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      ...(opts?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${path}: ${res.status} ${text}`)
  return text ? JSON.parse(text) : null
}

function openWs(path, token, onMsg) {
  const ws = new WebSocket(`${WS}${path}?token=${token}`)
  ws.on('message', (d) => { try { onMsg(JSON.parse(d.toString())) } catch {} })
  return new Promise((resolve) => ws.on('open', () => resolve(ws)))
}

function waitFor(cond, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const t = setInterval(() => {
      if (cond()) { clearInterval(t); resolve() }
      else if (Date.now() - start > timeout) { clearInterval(t); reject(new Error('timeout')) }
    }, 50)
  })
}

async function main() {
  const u1 = await login('test@test.com', 'password123')
  const u2 = await login('p2@test.com', 'password123')
  console.log('Logged in both')

  // cleanup
  try { await req(`/users/me/friends/${u2.user.id}`, { method: 'DELETE' }, u1.token) } catch {}

  console.log('--- Add friend ---')
  await req(`/users/me/friends/${u2.user.id}`, { method: 'POST' }, u1.token)
  const friends = await req('/users/me/friends', {}, u1.token)
  if (!friends.find((f) => f.user?.id === u2.user.id)) throw new Error('friend not added')
  console.log('Friend added ✓')

  console.log('--- Presence WS: u1 connects first, u2 after ---')
  const u1events = []
  const ws1 = await openWs('/ws/presence', u1.token, (m) => u1events.push(m))
  const ws2 = await openWs('/ws/presence', u2.token, () => {})

  await waitFor(() => u1events.some(m => m.type === 'presence' && m.userId === u2.user.id && m.status === 'online'), 2000)
  console.log('u1 saw u2 online ✓')

  ws2.close()
  await waitFor(() => u1events.some(m => m.type === 'presence' && m.userId === u2.user.id && m.status === 'offline'), 2000)
  console.log('u1 saw u2 offline ✓')

  ws1.close()

  console.log('--- Remove friend ---')
  await req(`/users/me/friends/${u2.user.id}`, { method: 'DELETE' }, u1.token)
  const friends2 = await req('/users/me/friends', {}, u1.token)
  if (friends2.find((f) => f.user?.id === u2.user.id)) throw new Error('friend not removed')
  console.log('Friend removed ✓')

  console.log('--- E2E Friends PASSED ✓ ---')
  process.exit(0)
}

main().catch((e) => {
  console.error('E2E Friends FAILED:', e.message)
  process.exit(1)
})
