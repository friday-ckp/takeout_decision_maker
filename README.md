# 🍱 外卖点餐决策器

> 30 秒内结束"今天吃什么"的纠结

一个本地部署的个人 Web 工具，用转盘和扫雷两种趣味方式，帮你快速从常用餐厅中做出决策。

---

## 为什么做这个

外卖 App 的设计目标是**延长你的停留时间**，而你只想**快点决定吃什么**。

这个工具反其道而行之：打开即决策，3 步以内搞定，彻底告别选择困难。

---

## 功能

| 功能 | 说明 |
|------|------|
| 🎡 转盘模式 | 一键旋转，停哪吃哪 |
| 💣 扫雷模式 | 盲点格子，第一个"炸"到的就是今天 |
| 🏪 餐厅管理 | 维护个人常点餐厅库，支持收藏和拉黑 |
| 🎯 决策过滤 | 可选填心情/口味偏好，可排除近期吃过的 |
| 📜 历史记录 | 查看每次决策结果 |
| 👥 多人协作 | 生成分享链接，WebSocket 实时同步多人决策 |

---

## 技术栈

```
前端：原生 HTML / CSS / JavaScript（无框架，无构建工具）
后端：Node.js + Express + ws
数据库：MySQL
```

架构图：

```
浏览器（静态文件）
      │ HTTP / WebSocket
   Node.js 后端
      │ mysql2
    MySQL 数据库
```

---

## 快速开始

### 前置要求

- Node.js >= 18
- MySQL >= 5.7（本地已有即可）

### 安装

```bash
# 1. 克隆仓库
git clone https://github.com/friday-ckp/takeout_decision_maker.git
cd takeout_decision_maker

# 2. 安装后端依赖
cd backend
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的数据库连接信息

# 4. 初始化数据库
npm run migrate

# 5. 启动服务
npm start
```

浏览器打开 `http://localhost:3000` 即可使用。

### 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `DB_HOST` | ✅ | MySQL 主机，通常为 `127.0.0.1` |
| `DB_PORT` | ✅ | MySQL 端口，默认 `3306` |
| `DB_USER` | ✅ | 数据库用户名 |
| `DB_PASSWORD` | ✅ | 数据库密码 |
| `DB_NAME` | ✅ | 数据库名（需提前创建） |
| `PORT` | ❌ | 服务端口，默认 `3000` |
| `SESSION_SECRET` | ❌ | 多人会话签名密钥，生产环境建议设置 |
| `APP_BASE_URL` | ❌ | 外部访问地址，用于生成分享链接 |

---

## 项目结构

```
takeout_decision_maker/
├── backend/
│   ├── src/
│   │   ├── routes/          # API 路由
│   │   ├── controllers/     # 业务逻辑
│   │   ├── models/          # 数据库模型
│   │   ├── middleware/       # 中间件
│   │   └── websocket/       # 多人协作 WebSocket
│   ├── migrations/          # 数据库迁移脚本
│   └── .env.example
├── frontend/
│   ├── pages/               # HTML 页面
│   ├── styles/              # CSS
│   └── scripts/             # JS 模块
└── _bmad-output/            # 项目规划文档（PRD/架构/Sprint 计划等）
```

---

## 开发计划

项目规划文档位于 `_bmad-output/`，包含完整的 PRD、架构设计、API 设计和 Sprint 计划（共 58 个 Story）。

- Sprint 1：基础架构 + 餐厅管理
- Sprint 2：转盘 + 扫雷决策核心
- Sprint 3：历史记录 + 过滤器
- Sprint 4：多人协作 + WebSocket
- Sprint 5：UI 打磨 + 部署优化

---

## License

MIT
