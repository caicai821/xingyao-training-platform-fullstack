#!/usr/bin/env node
/**
 * Optional local PostgreSQL for environments without Docker.
 * Uses embedded-postgres (PostgreSQL binaries distributed via npm).
 *
 * On Windows, PostgreSQL refuses to run under an elevated Administrator token,
 * so the foreground process is launched through `runas /trustlevel:0x20000`
 * when the current shell is elevated.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createWriteStream, existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const stateDir = path.join(root, '.devdb')
const dataDir = path.join(stateDir, 'data')
const stateFile = path.join(stateDir, 'state.json')
const logFile = path.join(stateDir, 'postgres.log')
const user = 'postgres'
const password = 'postgres'
const database = 'qicheng'
const port = Number(process.env.LOCAL_DB_PORT ?? 55432)

function isWindows() {
  return process.platform === 'win32'
}

function isElevated() {
  if (!isWindows()) return false
  const result = spawnSync('net', ['session'], { stdio: 'ignore' })
  return result.status === 0
}

async function readState() {
  try {
    return JSON.parse(await readFile(stateFile, 'utf8'))
  } catch {
    return null
  }
}

async function canConnect() {
  try {
    const { default: pg } = await import('pg')
    const client = new pg.Client({
      host: '127.0.0.1',
      port,
      user,
      password,
      database,
      connectionTimeoutMillis: 1000,
    })
    await client.connect()
    await client.query('SELECT 1')
    await client.end()
    return true
  } catch {
    return false
  }
}

async function waitUntilReady(timeoutMs = 90000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await canConnect()) return true
    await new Promise((resolve) => setTimeout(resolve, 800))
  }
  return false
}

function pgCtlPath() {
  const platformPackages = {
    win32: ['@embedded-postgres/windows-x64', 'pg_ctl.exe'],
    darwin: ['@embedded-postgres/darwin-x64', 'pg_ctl'],
    linux: ['@embedded-postgres/linux-x64', 'pg_ctl'],
  }
  const entry = platformPackages[process.platform]
  if (!entry) return null
  const candidate = path.join(root, 'node_modules', entry[0], 'native', 'bin', entry[1])
  return existsSync(candidate) ? candidate : null
}

async function runForeground() {
  const EmbeddedPostgres = (await import('embedded-postgres')).default
  await mkdir(stateDir, { recursive: true })

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user,
    password,
    port,
    persistent: true,
    initdbFlags: ['--locale=C', '--encoding=UTF8'],
  })

  const initialised = existsSync(path.join(dataDir, 'PG_VERSION'))
  if (!initialised) {
    console.log(`[local-db] initialising cluster at ${dataDir}`)
    await pg.initialise()
  }

  await pg.start()
  try {
    await pg.createDatabase(database)
  } catch (error) {
    if (!String(error).toLowerCase().includes('already exists')) throw error
  }

  await writeFile(
    stateFile,
    JSON.stringify({ pid: process.pid, port, dataDir, startedAt: new Date().toISOString() }, null, 2),
  )
  console.log(
    `[local-db] ready: postgresql://${user}:${password}@127.0.0.1:${port}/${database}`,
  )

  const shutdown = async () => {
    try {
      await pg.stop()
      await rm(stateFile, { force: true })
    } finally {
      process.exit(0)
    }
  }
  process.on('SIGINT', () => void shutdown())
  process.on('SIGTERM', () => void shutdown())
  setInterval(() => undefined, 1 << 30)
}

async function start() {
  if (await canConnect()) {
    console.log(`[local-db] already running on port ${port}`)
    return
  }
  await mkdir(stateDir, { recursive: true })
  const scriptPath = fileURLToPath(import.meta.url)

  if (isWindows() && isElevated()) {
    // runas takes one command line; a batch wrapper preserves spaces in paths.
    const wrapper = path.join(stateDir, 'run-db.cmd')
    const newline = String.fromCharCode(13) + String.fromCharCode(10)
    const command = [
      '@echo off',
      `cd /d "${root}"`,
      `"${process.execPath}" "${scriptPath}" run >> "${logFile}" 2>&1`,
      '',
    ].join(newline)
    await writeFile(wrapper, command)
    const child = spawn('runas', ['/trustlevel:0x20000', wrapper], {
      stdio: 'ignore',
      windowsHide: true,
    })
    child.unref()
    console.log('[local-db] elevated shell detected, launched via restricted token')
  } else {
    const log = createWriteStream(logFile, { flags: 'a' })
    const child = spawn(process.execPath, [scriptPath, 'run'], {
      detached: true,
      stdio: ['ignore', log, log],
      windowsHide: true,
    })
    child.unref()
  }

  const ready = await waitUntilReady()
  if (!ready) {
    console.error(
      `[local-db] failed to start within 90s. See ${logFile} for details.`,
    )
    process.exit(1)
  }
  console.log(
    `[local-db] ready: postgresql://${user}:${password}@127.0.0.1:${port}/${database}`,
  )
  console.log('[local-db] stop with: npm run db:stop')
}

async function stop() {
  const state = await readState()
  const pgCtl = pgCtlPath()
  if (pgCtl && existsSync(dataDir)) {
    const result = spawnSync(pgCtl, ['-D', dataDir, 'stop', '-m', 'fast'], {
      encoding: 'utf8',
      windowsHide: true,
    })
    if (result.status === 0) {
      console.log('[local-db] stopped')
    } else if (result.stderr) {
      console.error(result.stderr.trim())
    }
  }
  if (state?.pid) {
    if (isWindows()) {
      spawnSync('taskkill', ['/PID', String(state.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      })
    } else {
      try {
        process.kill(state.pid, 'SIGTERM')
      } catch {
        // Process already exited.
      }
    }
  }
  await rm(stateFile, { force: true })
  if (!pgCtl) {
    console.error(
      '[local-db] pg_ctl binary not found; if the server is still running, stop it manually.',
    )
    process.exit(1)
  }
}

async function status() {
  const running = await canConnect()
  console.log(running ? `[local-db] running on port ${port}` : '[local-db] not running')
  process.exit(running ? 0 : 1)
}

const command = process.argv[2]
if (command === 'start') await start()
else if (command === 'stop') await stop()
else if (command === 'status') await status()
else if (command === 'run') await runForeground()
else {
  console.log('Usage: node scripts/local-db.mjs <start|stop|status|run>')
  process.exit(1)
}
