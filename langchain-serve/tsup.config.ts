import { defineConfig } from 'tsup'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function pkgToBinaries() {
  const ext = process.platform === 'win32' ? '.exe' : ''
  const targetTriple = execSync('rustc --print host-tuple').toString().trim()
  if (!targetTriple) return
  // 基于配置文件所在目录解析，不依赖 process.cwd()
  const binariesDir = path.join(__dirname, '..', 'src-tauri', 'binaries')
  const bundlePath = path.join(__dirname, 'dist', 'index.js')
  const outputPath = path.join(binariesDir, `langchain-serve-${targetTriple}${ext}`)
  if (!fs.existsSync(bundlePath)) return
  fs.mkdirSync(binariesDir, { recursive: true })
  execSync(`pnpm exec pkg "${bundlePath}" --output "${outputPath}"`, { stdio: 'inherit', cwd: __dirname })
  console.log(`[watch] binary: ${outputPath}`)
}

export default defineConfig({
  entry: ['src/bin/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  splitting: false,
  sourcemap: true,
  clean: true,
  bundle: true,
  platform: 'node',
  treeshake: true,
  noExternal: [],
  onSuccess: pkgToBinaries,
})
