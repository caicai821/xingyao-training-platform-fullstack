import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/utils/password.js'

async function main() {
  const argUsername = process.argv[2]
  const argPassword = process.argv[3]
  const username = (process.env.ADMIN_USERNAME ?? argUsername ?? '').trim()
  const password = process.env.ADMIN_PASSWORD ?? argPassword ?? ''
  const displayName = (process.env.ADMIN_DISPLAY_NAME ?? '系统管理员').trim()

  if (!username) {
    console.error('缺少管理员账号。请设置 ADMIN_USERNAME 或作为第一个参数传入。')
    process.exit(1)
  }
  if (!/^[a-zA-Z0-9._-]{3,64}$/.test(username)) {
    console.error('管理员账号需为 3–64 位字母、数字、点、下划线或连字符。')
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('管理员密码至少需要 8 位。请通过 ADMIN_PASSWORD 环境变量提供。')
    process.exit(1)
  }

  const prisma = new PrismaClient()
  try {
    const passwordHash = await hashPassword(password)
    const user = await prisma.user.upsert({
      where: { username },
      create: {
        username,
        passwordHash,
        displayName,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      update: {
        passwordHash,
        displayName,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    })
    console.log(`管理员账号已就绪：${user.username}（${user.displayName}）`)
    console.log('请妥善保管密码；此脚本会重置该账号的密码。')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
