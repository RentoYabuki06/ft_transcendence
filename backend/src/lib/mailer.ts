import nodemailer from 'nodemailer'

// SMTP が設定されていない場合はコンソールに出力する開発用トランスポートを使う
let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !port) return null
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  })
  return transporter
}

export async function sendMail(opts: { to: string; subject: string; text: string }) {
  const tx = getTransporter()
  const from = process.env.SMTP_FROM || 'no-reply@ft-transcendence.local'

  if (!tx) {
    // Dev fallback: log to console so the user can copy the OTP from server logs
    console.log('\n===== DEV EMAIL (SMTP未設定) =====')
    console.log(`To: ${opts.to}`)
    console.log(`Subject: ${opts.subject}`)
    console.log(`Body:\n${opts.text}`)
    console.log('================================\n')
    return
  }

  await tx.sendMail({ from, to: opts.to, subject: opts.subject, text: opts.text })
}

export function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}
