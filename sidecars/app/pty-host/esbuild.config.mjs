import esbuild from 'esbuild'

const watch = process.argv.includes('--watch')

const buildOptions = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'dist/index.js',
  external: ['node-pty'],
}

if (watch) {
  const ctx = await esbuild.context(buildOptions)
  await ctx.watch()
  console.log('[pty-host] watching src/...')
} else {
  await esbuild.build(buildOptions)
}
