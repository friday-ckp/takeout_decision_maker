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

// 前端静态文件托管
app.use(express.static(path.join(__dirname, '../../frontend')));

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
