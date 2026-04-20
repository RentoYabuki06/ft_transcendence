// E2E: 2FA setup + challenge login flow
import speakeasy from 'speakeasy'

const API = 'http://localhost:3000'

async function req(path, opts = {}, token) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${JSON.stringify(json)}`)
  return json
}

async function main() {
  console.log('--- Login testuser ---')
  const login1 = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'test@test.com', password: 'password123' }),
  })
  if (!('token' in login1)) throw new Error('Expected plain login')
  const token = login1.token
  console.log('Logged in:', login1.user.nickname)

  // Ensure 2FA disabled first
  try {
    await req('/users/me/2fa', { method: 'DELETE' }, token)
  } catch {}

  console.log('--- 2FA setup ---')
  const setup = await req('/users/me/2fa/setup', { method: 'POST' }, token)
  console.log('Got secret:', setup.secret.slice(0, 8) + '...')

  const code = speakeasy.totp({ secret: setup.secret, encoding: 'base32' })
  console.log('TOTP code:', code)

  console.log('--- 2FA verify (enable) ---')
  await req('/users/me/2fa/verify', { method: 'POST', body: JSON.stringify({ code }) }, token)
  console.log('2FA enabled ✓')

  console.log('--- Login again (should require 2FA) ---')
  const login2 = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'test@test.com', password: 'password123' }),
  })
  if (!login2.requires2fa) throw new Error('Expected requires2fa=true')
  console.log('Got tempToken ✓')

  console.log('--- Submit 2FA challenge ---')
  const code2 = speakeasy.totp({ secret: setup.secret, encoding: 'base32' })
  const login3 = await req('/auth/2fa/challenge', {
    method: 'POST',
    body: JSON.stringify({ tempToken: login2.tempToken, code: code2 }),
  })
  if (!login3.token) throw new Error('Expected final token')
  console.log('Final login ✓ user:', login3.user.nickname)

  console.log('--- Disable 2FA (cleanup) ---')
  await req('/users/me/2fa', { method: 'DELETE' }, login3.token)
  console.log('Cleaned up ✓')

  console.log('--- E2E 2FA PASSED ✓ ---')
  process.exit(0)
}

main().catch((e) => {
  console.error('E2E 2FA FAILED:', e.message)
  process.exit(1)
})
