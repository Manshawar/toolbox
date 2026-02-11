import esbuild from 'esbuild'

const watch = process.argv.includes('--watch')

const buildOptions = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: 'dist',
  outbase: 'src',
  external: [],
}

if (watch) {
  const ctx = await esbuild.context(buildOptions)
  await ctx.watch()
  console.log('[langchain-serve] watching src/...')
} else {
  await esbuild.build(buildOptions)
}
