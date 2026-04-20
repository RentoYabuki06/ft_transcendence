// E2E: Chat real-time send/receive via WS
import WebSocket from 'ws'

const API = 'http://localhost:3000'
const WS = 'ws://localhost:3000'

async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(`login ${email}: ${res.status}`)
  return res.json()
}

function openWs(path, token, onMsg) {
  const ws = new WebSocket(`${WS}${path}?token=${token}`)
  ws.on('message', (d) => {
    try { onMsg(JSON.parse(d.toString())) } catch {}
  })
  return new Promise((resolve, reject) => {
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

function waitFor(cond, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const t = setInterval(() => {
      if (cond()) { clearInterval(t); resolve() }
      else if (Date.now() - start > timeout) { clearInterval(t); reject(new Error('timeout')) }
    }, 50)
  })
}

async function main() {
  console.log('--- Login both users ---')
  const u1 = await login('test@test.com', 'password123')
  const u2 = await login('p2@test.com', 'password123')

  console.log('--- Open chat WS for u2 (receiver) ---')
  let received = null
  const ws2 = await openWs('/ws/chat', u2.token, (m) => {
    if (m.type === 'chat_message') received = m
  })

  console.log('--- u1 sends message to u2 ---')
  const body = 'hello ' + Date.now()
  const sendRes = await fetch(`${API}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${u1.token}` },
    body: JSON.stringify({ receiverId: u2.user.id, body }),
  })
  if (!sendRes.ok) throw new Error(`send failed: ${sendRes.status}`)

  await waitFor(() => received !== null, 3000)
  if (received.body !== body) throw new Error(`body mismatch: ${received.body} vs ${body}`)
  console.log('u2 received real-time:', received.body)

  console.log('--- Verify GET /messages/:userId ---')
  const listRes = await fetch(`${API}/messages/${u2.user.id}`, {
    headers: { Authorization: `Bearer ${u1.token}` },
  })
  const list = await listRes.json()
  const found = list.find((m) => m.body === body)
  if (!found) throw new Error('message not in history')
  console.log('Found in history ✓')

  ws2.close()
  console.log('--- E2E Chat PASSED ✓ ---')
  process.exit(0)
}

main().catch((e) => {
  console.error('E2E Chat FAILED:', e.message)
  process.exit(1)
})
