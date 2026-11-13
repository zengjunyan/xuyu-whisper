import { serve } from '@hono/node-server'
import { createApp } from './app'

const port = Number(process.env.PORT ?? 8787)
const app = createApp()

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`絮语 API 已启动：http://127.0.0.1:${info.port}（内存存储，重启即重置）`)
})

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`端口 ${port} 已被占用，请先关闭占用进程或设置 PORT 后重试。`)
  } else {
    console.error(`API 启动失败：${error.message}`)
  }
  process.exit(1)
})
