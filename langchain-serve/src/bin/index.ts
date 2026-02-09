import { Hono, type Context } from 'hono'
import { serve } from '@hono/node-server'

const HOST = '127.0.0.1'

const app = new Hono()

// 仅保留一个初始接口用于测试
app.get('/health', (c: Context) => c.json({ ok: true }))

const command = process.argv[2]
if (command !== 'serve') {
  console.error('Usage: langchain-serve serve')
  process.exit(1)
}

// port: 0 由系统分配可用端口，避免固定端口被占用
serve(
  { fetch: app.fetch, port: 0, hostname: HOST },
  (info: { port: number }) => {
    console.log(`PORT=${info.port}`)
  }
)
