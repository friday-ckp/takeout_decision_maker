require('dotenv').config();
const app = require('./app');
const { testConnection } = require('./models/db');

const PORT = process.env.PORT || 3000;

async function start() {
  // 启动 HTTP 服务（无论数据库是否可用，前端始终可访问）
  app.listen(PORT, () => {
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
