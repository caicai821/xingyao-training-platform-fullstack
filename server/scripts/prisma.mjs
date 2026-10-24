#!/usr/bin/env node
/**
 * Runs the local Prisma CLI, reusing engine binaries bundled in node_modules.
 * This keeps `prisma generate`/`migrate` working on networks where the engine
 * CDN (binaries.prisma.sh) is unreachable; normal environments are unaffected.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const engineDir = path.join(root, 'node_modules', '@prisma', 'engines')
const engines = {
  win32: ['query_engine-windows.dll.node', 'schema-engine-windows.exe'],
  darwin: ['libquery_engine-darwin.dylib.node', 'schema-engine-darwin'],
  linux: ['libquery_engine-debian-openssl-3.0.x.so.node', 'schema-engine-debian-openssl-3.0.x'],
}[process.platform]

const env = { ...process.env }
if (engines) {
  const [query, schema] = engines.map((file) => path.join(engineDir, file))
  if (existsSync(query)) env.PRISMA_QUERY_ENGINE_LIBRARY = query
  if (existsSync(schema)) env.PRISMA_SCHEMA_ENGINE_BINARY = schema
  if (existsSync(query) && existsSync(schema)) env.PRISMA_GENERATE_SKIP_AUTOINSTALL = 'true'
}

const cli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js')
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
  cwd: root,
})
process.exit(result.status ?? 1)
