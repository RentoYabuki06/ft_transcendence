import jwt from 'jsonwebtoken'

function loadJwtSecret(): string {
  const s = process.env.JWT_SECRET
  if (!s || s.length < 32) {
    throw new Error(
      'JWT_SECRET 環境変数が未設定または短すぎます (最低32文字)。.env を設定してください。'
    )
  }
  return s
}
const JWT_SECRET: string = loadJwtSecret()
const JWT_EXPIRES_IN = '7d'

export interface JwtPayload {
  userId: number
  email: string
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload
}
