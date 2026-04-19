import 'dotenv/config'
import prisma from './lib/prisma.js'

const statuses = [
  { category: 'user',     name: 'active',    description: 'アクティブなユーザー' },
  { category: 'user',     name: 'banned',    description: 'BANされたユーザー' },
  { category: 'game',     name: 'pending',   description: '開始前の試合' },
  { category: 'game',     name: 'ongoing',   description: '進行中の試合' },
  { category: 'game',     name: 'finished',  description: '終了した試合' },
  { category: 'gametype', name: 'standard',  description: '標準ゲームタイプ' },
  { category: 'waitroom', name: 'waiting',   description: 'マッチング待機中' },
  { category: 'waitroom', name: 'matched',   description: 'マッチング成立' },
  { category: 'account',  name: 'active',    description: 'アクティブなアカウント連携' },
]

const achievements = [
  { key: 'first_win',    name: '初勝利',       description: '初めて試合に勝利した',           icon: '🏆' },
  { key: 'ten_wins',     name: '10勝',         description: '通算10勝を達成した',             icon: '⭐' },
  { key: 'fifty_wins',   name: '50勝',         description: '通算50勝を達成した',             icon: '🌟' },
  { key: 'social',       name: '友達100人',    description: 'フレンドを1人以上追加した',      icon: '👥' },
  { key: 'two_fa',       name: 'セキュア',     description: '2FA（二要素認証）を有効にした',  icon: '🔐' },
]

async function seed() {
  console.log('🌱 Seeding statuses...')
  for (const s of statuses) {
    await prisma.statuses.upsert({
      where: { category_name: { category: s.category, name: s.name } },
      update: {},
      create: s,
    })
  }

  console.log('🌱 Seeding achievements...')
  for (const a of achievements) {
    await prisma.achievements.upsert({
      where: { key: a.key },
      update: {},
      create: a,
    })
  }

  // GameTypes seed
  const standardStatus = await prisma.statuses.findFirst({ where: { category: 'gametype', name: 'standard' } })
  if (standardStatus) {
    const existing = await prisma.gameTypes.findFirst()
    if (!existing) {
      await prisma.gameTypes.create({ data: { statusId: standardStatus.id, gameType: '2人対戦' } })
      console.log('🌱 Seeded GameTypes')
    }
  }

  console.log('✅ Seed complete')
  await prisma.$disconnect()
}

seed().catch(e => {
  console.error(e)
  process.exit(1)
})
