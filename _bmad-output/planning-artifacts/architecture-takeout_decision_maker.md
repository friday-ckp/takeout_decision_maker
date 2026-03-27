---
title: "Architecture: takeout_decision_maker"
type: architecture
phase: 3-solutioning
status: complete
created: "2026-03-27"
updated: "2026-03-27"
author: Friday
project: takeout_decision_maker
inputDocuments:
  - _bmad-output/planning-artifacts/prd-takeout_decision_maker.md
  - _bmad-output/planning-artifacts/ux-design-takeout_decision_maker.md
artifacts:
  - architecture-takeout_decision_maker.html
  - api-design-takeout_decision_maker.md
---

# 架构设计文档：外卖点餐决策器

## 架构概览

本项目采用轻量单体架构，本地部署，无外部依赖。

```
┌─────────────────────────────────┐
│         前端（静态文件）          │
│   HTML / CSS / Vanilla JS        │
│   - 无框架，无构建工具            │
│   - 通过 Nginx 或 Node 静态托管  │
└──────────────┬──────────────────┘
               │ HTTP / WebSocket
┌──────────────▼──────────────────┐
│         后端（Node.js）          │
│   Express + ws                   │
│   - REST API                     │
│   - WebSocket Server             │
│   - 环境变量配置                 │
└──────────────┬──────────────────┘
               │ mysql2
┌──────────────▼──────────────────┐
│         数据库（MySQL）          │
│   用户自行提供连接信息           │
│   通过 .env 文件配置             │
└─────────────────────────────────┘
```

---

## 技术栈决策

| 层级 | 技术 | 选型理由 |
|------|------|----------|
| 前端 | 原生 HTML/CSS/JS | 零依赖，本地部署最简单，无需构建 |
| 后端 | Node.js (Express) | 轻量，与前端同语言，生态成熟 |
| 数据库 | MySQL | 用户已有，持久化可靠 |
| WebSocket | ws 库 | 轻量纯 Node.js 实现，无需额外中间件 |
| 会话状态 | Memory Map（单进程） | MVP 阶段够用，v2 可迁移 Redis |

---

## 目录结构

```
takeout_decision_maker/
├── backend/
│   ├── src/
│   │   ├── routes/          # Express 路由
│   │   ├── controllers/     # 业务逻辑
│   │   ├── models/          # 数据库模型
│   │   ├── middleware/      # 中间件（错误处理等）
│   │   ├── websocket/       # WebSocket 处理
│   │   └── utils/           # 工具函数
│   ├── migrations/          # 数据库迁移脚本
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── pages/               # HTML 页面
│   ├── styles/              # CSS
│   ├── scripts/             # JS 模块
│   └── assets/              # 图片/图标
└── docs/                    # 项目文档（project_knowledge）
```

---

## 数据模型

详见 PRD 第五节数据模型，共 7 张表：

- `users` — 用户（含默认单用户 id=1 和多人临时用户）
- `restaurants` — 餐厅（含软删除）
- `user_restaurant_relations` — 收藏/拉黑关系
- `decision_history` — 决策历史
- `daily_config` — 每日心情/口味/重玩次数
- `settings` — 全局设置
- `decision_sessions` + `session_participants` — 多人会话

---

## API 设计

详见：[api-design-takeout_decision_maker.md](./api-design-takeout_decision_maker.md)

---

## WebSocket 设计

### 连接
```
ws://host/ws/sessions/:token?nickname=<nickname>
```

### 事件流
```
客户端加入 → session_state 推送
有人加入   → participant_joined 广播
Host 开始  → deciding_started 广播（含候选快照）
点击格子   → cell_clicked → result_revealed 广播
Host 确认  → session_done 广播 → 会话结束
```

### 多人状态机
```
waiting → deciding → done
              ↑
           (replay)
```

---

## 关键技术决策

### 1. 单用户 vs 多用户
- 单用户默认 `user_id=1`，无需登录
- 多人临时用户通过昵称创建，会话过期后惰性清理
- **昵称存储机制**：受邀者加入会话时，后端在 `users` 表创建一条临时记录，`users.name` 字段存储用户输入的昵称；`session_participants` 表通过 `user_id` 关联该临时用户记录，**不额外存储 nickname 字段**。等待室显示昵称时，JOIN `users` 表取 `name` 字段即可。

### 2. 收藏 2 倍权重实现
- 转盘：候选列表中收藏餐厅出现 2 次（双份扇形）
- 扫雷：收藏餐厅占 2 个格子，上限 12 格约束下优先保留

### 3. 惰性触发机制（无定时任务）
- 回收站 7 天清理：GET `/restaurants/trash` 时触发
- 跨日重置 replay_count：发起决策请求时检查 daily_config.date
- 临时用户清理：任意 API 请求时异步后台执行

### 4. 多人候选快照
- 会话创建时快照发起人候选餐厅 ID 列表
- 后续决策以快照为准，隔离发起人数据变更

---

## 非功能需求

| 指标 | 目标值 |
|------|--------|
| 首屏加载 | < 2s（本地网络） |
| API 响应 | < 500ms（单人） |
| WS 广播延迟 | < 500ms（局域网） |
| 最大并发用户 | 10 人/会话 |
| WS 断线重连 | 最大间隔 5s，自动重连 |

---

## 架构可视化

详见附件文件：[architecture-takeout_decision_maker.html](./architecture-takeout_decision_maker.html)
