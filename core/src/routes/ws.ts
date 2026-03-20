import type { FastifyInstance } from "fastify";

/**
 * 注册 WebSocket 路由
 * 提供 /ws 端点用于测试 WebSocket 连接
 */
export async function registerWsRoutes(app: FastifyInstance): Promise<void> {
  // WebSocket 回显服务：接收消息并原样返回
  app.get("/ws", { websocket: true }, (socket, req) => {
    app.log.info({ url: req.url }, "WebSocket client connected");

    socket.on("message", (message: Buffer) => {
      const data = message.toString();
      app.log.info({ data }, "WebSocket message received");

      // 回显消息给客户端
      socket.send(
        JSON.stringify({
          type: "echo",
          received: data,
          timestamp: Date.now(),
        })
      );
    });

    socket.on("close", () => {
      app.log.info("WebSocket client disconnected");
    });

    socket.on("error", (err: Error) => {
      app.log.error({ err }, "WebSocket error");
    });

    // 发送欢迎消息
    socket.send(
      JSON.stringify({
        type: "welcome",
        message: "WebSocket connected to langchain-serve",
        timestamp: Date.now(),
      })
    );
  });
}
