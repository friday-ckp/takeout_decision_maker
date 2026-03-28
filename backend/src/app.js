const express = require('express');
const path = require('path');
const cors = require('cors');
const { requestIdMiddleware } = require('./middleware/requestId');
const { errorHandler } = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

// 解析 JSON body
app.use(express.json());
app.use(cors());

// 请求 ID 中间件
app.use(requestIdMiddleware);

// 前端静态文件托管（Story 7.1: 设置 Cache-Control）
app.use(express.static(path.join(__dirname, '../../frontend'), {
  setHeaders(res, filePath) {
    if (/\.(css|js)$/.test(filePath)) {
      // CSS/JS 不缓存，保证始终加载最新版本
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (/\.(png|jpg|jpeg|gif|svg|ico|webp)$/.test(filePath)) {
      // 图片缓存7天
      res.setHeader('Cache-Control', 'public, max-age=604800');
    } else {
      // HTML 不缓存（保证总是最新版本）
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

// Story 7.7: 数据库配置状态检查 API
app.get('/api/db-status', async (req, res) => {
  const { testConnection } = require('./models/db');
  try {
    await testConnection();
    res.json({ code: 0, message: 'ok', data: { connected: true } });
  } catch (e) {
    res.json({ code: 0, message: 'ok', data: { connected: false, error: e.message } });
  }
});

// API 路由
app.use('/api', routes);

// 前端 SPA fallback（非 /api 路径返回 index.html）
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../../frontend/pages/index.html'));
  }
});

// 全局错误处理（必须放最后）
app.use(errorHandler);

module.exports = app;
