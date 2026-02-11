import { defineConfig } from 'tsup'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const TARGET_MAP: Record<string, string> = {
  'aarch64-apple-darwin': 'node18-macos-arm64',
  'x86_64-apple-darwin': 'node18-macos-x64',
  'x86_64-pc-windows-msvc': 'node18-win-x64',
  'x86_64-unknown-linux-gnu': 'node18-linux-x64',
}

function pkgToBinaries() {
  const targetTriple =
    process.env.SIDECAR_TARGET ?? execSync('rustc --print host-tuple').toString().trim()
  if (!targetTriple) return
  const pkgTarget = TARGET_MAP[targetTriple]
  if (!pkgTarget) {
    console.warn(`[core] unknown target ${targetTriple}, skip pkg`)
    return
  }
  const ext = targetTriple.includes('windows') ? '.exe' : ''
  const binariesDir = path.join(__dirname, '..', '..', 'src-tauri', 'binaries')
  const bundlePath = path.join(__dirname, 'dist', 'index.js')
  const outputPath = path.join(binariesDir, `core-${targetTriple}${ext}`)
  if (!fs.existsSync(bundlePath)) return
  fs.mkdirSync(binariesDir, { recursive: true })
  execSync(`pnpm exec pkg "${bundlePath}" --target ${pkgTarget} --output "${outputPath}"`, {
    stdio: 'inherit',
    cwd: __dirname,
  })
  console.log(`[watch] binary: ${outputPath}`)
}

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  splitting: false,
  sourcemap: true,
  clean: true,
  bundle: true,
  platform: 'node',
  treeshake: true,
  external: ['node-pty'],
  noExternal: ['langchain-serve', 'pty-host'],
  onSuccess: async () => await pkgToBinaries(),
})
