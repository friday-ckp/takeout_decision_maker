require('dotenv').config();
const http = require('http');
const app = require('./app');
const { testConnection } = require('./models/db');
const { attachWebSocketServer } = require('./websocket/server');

const PORT = process.env.PORT || 3000;

async function start() {
  // 创建 HTTP server（供 WebSocket 共享）
  const server = http.createServer(app);

  // 附加 WebSocket 服务器
  attachWebSocketServer(server);

  // 启动监听
  server.listen(PORT, () => {
    console.log(`[Server] 外卖决策器后端已启动，监听端口 ${PORT}`);
    console.log(`[Server] 访问地址: http://localhost:${PORT}`);
  });

  // 异步检查数据库连接
  try {
    await testConnection();
    console.log('[Server] 数据库连接成功');
  } catch (err) {
    console.warn(`[Server] ⚠️  数据库未连接：${err.message}`);
    console.warn('[Server] 前端页面仍可访问，API 调用将返回错误，请配置 .env 后重启');
  }
}

start();
