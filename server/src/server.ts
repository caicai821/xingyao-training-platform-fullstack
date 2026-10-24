import { buildApp } from './app.js'
import { loadConfig } from './config/env.js'
import { isProviderConfigured } from './config/env.js'

async function main() {
  const config = loadConfig()
  const app = await buildApp({ config })

  const generationSummary = {
    script: `${config.scriptProvider.mode}${isProviderConfigured(config.scriptProvider) ? '' : ' (未配置)'}`,
    profile: `${config.profileProvider.mode}${isProviderConfigured(config.profileProvider) ? '' : ' (未配置)'}`,
    scene: `${config.sceneProvider.mode}${isProviderConfigured(config.sceneProvider) ? '' : ' (未配置)'}`,
  }
  if (!process.env.UPLOAD_SIGNING_SECRET) {
    app.log.warn(
      'UPLOAD_SIGNING_SECRET 未设置，已生成临时密钥；重启后未消费的图片签名链接会失效。生产环境请显式配置。',
    )
  }

  app.log.info(
    { port: config.port, database: 'connected', generation: generationSummary },
    'starting qicheng API server',
  )

  try {
    await app.listen({ port: config.port, host: config.host })
  } catch (error) {
    app.log.error({ err: error }, 'failed to start server')
    process.exit(1)
  }

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down')
    try {
      await app.close()
      process.exit(0)
    } catch (error) {
      app.log.error({ err: error }, 'shutdown failed')
      process.exit(1)
    }
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
