import type { AppConfig } from '../config/env.js'
import { createMockProviders } from './mock.js'
import { createRealProviders } from './real.js'
import type { Providers } from './types.js'

export type * from './types.js'

export function createProviders(config: AppConfig): Providers {
  const real = createRealProviders({
    script: config.scriptProvider,
    profile: config.profileProvider,
    scene: config.sceneProvider,
  })
  const mock = createMockProviders({
    mockSceneQueueMs: config.mockSceneQueueMs,
    mockSceneGenerateMs: config.mockSceneGenerateMs,
  })

  return {
    script: config.scriptProvider.mode === 'real' ? real.script : mock.script,
    profile: config.profileProvider.mode === 'real' ? real.profile : mock.profile,
    scene: config.sceneProvider.mode === 'real' ? real.scene : mock.scene,
  }
}
