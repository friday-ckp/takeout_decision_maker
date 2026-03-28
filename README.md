# 今天吃啥 🎡

> 30 秒结束「今天吃什么」的选择困难症

一个本地部署的个人 Web 工具，提供转盘抽取、扫雷翻牌两种趣味决策方式，内置收藏/拉黑、心情过滤、历史排除、多人联机决策等功能。

---

## 功能概览

### 餐厅库管理
- **添加餐厅**：填写名称、品类、标签、备注，支持首页快捷添加
- **批量导入**：粘贴 JSON 数组一键导入多家餐厅
- **编辑 / 软删除**：已删除的餐厅进入回收站，可随时恢复
- **收藏**：收藏的餐厅在转盘上占双倍扇区，更容易被选中；不受历史排除影响
- **拉黑**：拉黑后不参与任何决策，黑名单页可查看和解除拉黑

### 决策模式

#### 🎡 转盘模式
- 按收藏权重生成候选转盘，收藏餐厅占 2 个扇区（普通餐厅 1 个）
- 超过 16 家候选时进入「勾选精简页」，手动挑选参与本次抽取
- Canvas 动画旋转，easeOut 缓动效果，结果醒目展示
- 结果页支持「换一个」重新旋转

#### 💣 扫雷模式
- 候选餐厅随机混入地雷格，翻到地雷提示继续，翻到餐厅即为结果
- CSS 3D 翻牌动画，刺激感十足
- 支持「换一个」重新洗牌再翻

### 个性化过滤

| 过滤类型 | 说明 |
|----------|------|
| 心情过滤 | 😊开心/😐一般 → 不过滤；😴困倦 → 轻食类餐厅加权（占更大扇区）；😤烦躁 → 自动排除带辣食标签的餐厅 |
| 口味偏好 | 在决策页勾选重口/清淡/辣/甜/快手/健康/素食/海鲜等标签，只抽匹配的餐厅 |
| 历史排除 | 最近 N 天内吃过的餐厅自动跳过（收藏的不排除），N 可在设置中调整 |

### 今日决策次数
- 每天有固定次数（默认 3 次，可在设置中调整为 1～10 次）
- **「换一个」消耗 1 次，「就这家了！」确认也消耗 1 次**
- 当日次数用完后，转盘和扫雷入口自动禁用，转盘页显示剩余次数
- 次日零点自动重置

### 历史记录
- 自动记录每次确认的决策（餐厅、决策模式、时间）
- 历史页按时间倒序展示，直观回顾

### 设置
- 每日决策次数上限（1～10 次）
- 历史排除天数（0 = 不排除，最多 30 天）

### 多人联机决策（实验性）
- 发起人生成邀请链接，多人加入同一个决策房间
- 支持多人转盘 / 扫雷模式，发起人确认最终结果广播给所有人
- 基于 WebSocket 实时同步所有参与者状态

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | 原生 HTML / CSS / JavaScript（无框架）、Canvas 2D API、CSS 3D Transforms |
| 后端 | Node.js + Express |
| 数据库 | MySQL 8.0 / MariaDB 10.6+ |
| 实时通信 | WebSocket（ws@8.x） |
| 测试 | Jest（单元/集成）、Playwright（E2E） |

---

## 项目结构

```
takeout_decision_maker/
├── backend/
│   ├── migrations/
│   │   └── init.js                    # 数据库 DDL 初始化脚本（幂等，可重复执行）
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── candidatesController.js  # 候选列表（权重算法 + 心情/口味/历史过滤）
│   │   │   ├── dailyConfigController.js # 每日次数配置（跨日自动重置）
│   │   │   ├── historyController.js     # 决策历史记录
│   │   │   ├── restaurantsController.js # 餐厅 CRUD + 收藏/拉黑
│   │   │   ├── sessionsController.js    # 多人会话管理
│   │   │   └── settingsController.js    # 用户个性化设置
│   │   ├── middleware/
│   │   │   ├── auth.js                  # X-User-Id 请求鉴权
│   │   │   └── requestId.js             # 请求 ID 注入（日志追踪）
│   │   ├── models/
│   │   │   └── db.js                    # MySQL 连接池（支持 TCP 和 Unix socket）
│   │   ├── routes/
│   │   │   └── index.js                 # API 路由汇总注册
│   │   ├── utils/
│   │   │   └── response.js              # 统一响应格式 {code, message, data}
│   │   ├── websocket/
│   │   │   └── server.js                # WebSocket 服务器（多人会话事件处理）
│   │   ├── app.js                       # Express 应用（中间件 + 静态文件托管）
│   │   └── index.js                     # 服务启动入口
│   ├── tests/
│   │   ├── app.test.js                  # API 集成测试
│   │   └── ws-stress.test.js            # WebSocket 并发压力测试（10 客户端，P95<500ms）
│   ├── .env.example                     # 环境变量配置示例
│   └── package.json
├── frontend/
│   ├── pages/
│   │   └── index.html                   # 单页应用（所有页面内联，SPA 路由）
│   ├── scripts/
│   │   ├── api.js                       # fetch 封装（自动携带 X-User-Id 请求头）
│   │   ├── app.js                       # 页面路由导航、心情选择、口味过滤
│   │   ├── restaurants.js               # 餐厅列表、添加/编辑、收藏、拉黑
│   │   ├── wheel.js                     # 转盘 Canvas 动画 + 完整决策流程
│   │   ├── minesweeper.js               # 扫雷翻牌动画 + 完整决策流程
│   │   ├── history-page.js              # 历史记录页
│   │   ├── settings.js                  # 设置页（次数上限、历史排除天数）
│   │   └── session.js                   # 多人会话（WebSocket 客户端，mp 前缀函数避免命名冲突）
│   └── styles/
│       ├── main.css                     # 全局样式
│       └── variables.css                # CSS 变量（颜色、间距等）
├── e2e-tests/                           # Playwright E2E 测试套件
│   └── tests/
│       ├── decision-flow.spec.js        # 转盘/扫雷决策流程测试
│       ├── favorites-blacklist.spec.js  # 收藏/拉黑功能测试
│       ├── history-settings.spec.js     # 历史记录/设置页测试
│       └── restaurants.spec.js          # 餐厅管理测试
├── docs/
│   ├── browser-compatibility.md         # 跨浏览器兼容性报告
│   └── launch-checklist.md              # 上线前检查清单（8 个类别）
├── DEPLOY.md                            # 完整部署指南
└── README.md
```

---

## 数据库设计

| 表名 | 说明 |
|------|------|
| `users` | 用户表（当前为单用户，id=1） |
| `restaurants` | 餐厅库（is_deleted 软删除） |
| `user_restaurant_relations` | 收藏 / 拉黑关系（relation_type: favorite \| blocked） |
| `decision_history` | 决策历史（餐厅 ID、决策模式、时间） |
| `daily_config` | 每日次数记录（user_id + date 唯一，跨日自动重置） |
| `settings` | 用户设置（key-value 键值对） |
| `sessions` | 多人会话（token、状态、成员数） |
| `session_members` | 会话参与者（userId、昵称、加入时间） |

---

## 快速启动

### 环境要求
- Node.js >= 18
- MySQL 8.0 或 MariaDB 10.6+

### 安装与启动

```bash
# 1. 进入后端目录
cd takeout_decision_maker/backend

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，填写数据库连接信息（见下方说明）

# 4. 初始化数据库（自动建表，可重复执行）
npm run migrate

# 5. 启动服务
npm start

# 开发模式（文件变更自动重启）
npm run dev
```

服务启动后访问 `http://localhost:3000`

### 环境变量说明

```env
# 数据库连接（必填，二选一）
# 方式一：TCP 连接
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=takeout_decision

# 方式二：Unix socket 连接（MariaDB 本地部署常用）
# DB_SOCKET=/var/run/mysqld/mysqld.sock

# 服务配置
PORT=3000                         # 监听端口，默认 3000
NODE_ENV=development              # development | production

# 多人会话（可选）
SESSION_SECRET=change_me_32chars  # 建议使用随机 32 位字符串
SESSION_EXPIRE_HOURS=24           # 会话有效期，默认 24 小时
APP_BASE_URL=http://localhost:3000 # 生产环境必须修改为实际域名（用于生成分享链接）
```

---

## API 接口

所有接口均需携带请求头：`X-User-Id: 1`

统一响应格式：
```json
{ "code": 0, "message": "ok", "data": { ... } }
```

### 餐厅管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/restaurants` | 获取餐厅列表（含 isFavorite / isBlocked 状态） |
| POST | `/api/restaurants` | 添加单个餐厅 |
| POST | `/api/restaurants/import` | 批量导入 JSON 数组 |
| PUT | `/api/restaurants/:id` | 编辑餐厅信息 |
| DELETE | `/api/restaurants/:id` | 软删除（移入回收站） |
| GET | `/api/restaurants/trash` | 回收站列表 |
| POST | `/api/restaurants/:id/restore` | 从回收站恢复 |
| GET | `/api/restaurants/favorites` | 收藏列表 |
| POST | `/api/restaurants/:id/favorite` | 收藏 / 取消收藏（toggle） |
| GET | `/api/restaurants/blacklist` | 黑名单列表 |
| POST | `/api/restaurants/:id/block` | 拉黑 / 解除拉黑（toggle） |

### 决策与配置

| 方法 | 路径 | 参数 | 说明 |
|------|------|------|------|
| GET | `/api/candidates` | mood, flavors, limit | 转盘候选列表（含权重/过滤） |
| GET | `/api/candidates/mine` | mood, flavors | 扫雷候选格子数据 |
| GET | `/api/daily-config` | — | 获取今日次数（replayCount / maxReplayCount） |
| PATCH | `/api/daily-config` | `{"incrementReplay": true}` | 消耗 1 次今日次数 |
| POST | `/api/history` | `{restaurantId, mode}` | 记录决策历史 |
| GET | `/api/history` | — | 获取历史列表 |
| GET | `/api/settings` | — | 获取用户设置 |
| PATCH | `/api/settings` | `{key, value}` | 更新单条设置 |

---

## 运行测试

```bash
# 后端单元 + 集成测试
cd backend
npm test

# E2E 测试（需先在另一终端启动服务）
cd e2e-tests
npm install
npx playwright test

# 查看 E2E 测试报告
npx playwright show-report
```

---

## 部署

详见 [DEPLOY.md](./DEPLOY.md)，包含：
- Linux 服务器环境准备
- Nginx 反向代理配置示例
- PM2 进程守护
- HTTPS 证书申请（Let's Encrypt）
- 上线前检查清单（[docs/launch-checklist.md](./docs/launch-checklist.md)）

---

## 常见问题

**Q：今日次数怎么计算？**
A：每次点击「换一个」消耗 1 次，点击「就这家了！」确认结果也消耗 1 次。默认每天共 3 次，可在设置中调整（1～10 次）。次日零点自动重置。

**Q：为什么候选里没有某家餐厅？**
A：以下情况会被排除：① 已拉黑；② 最近 N 天内已选过（收藏的餐厅不受历史排除限制）；③ 不符合当前口味偏好过滤条件；④ 带辣食标签且心情为 😤 烦躁。

**Q：收藏有什么效果？**
A：收藏的餐厅在转盘上占 2 个扇区（普通 1 个），更容易被选中。若心情为 😴 困倦且餐厅带轻食标签，还可额外加权至 3 个扇区。同时，收藏的餐厅不受历史排除影响，每天都会出现在候选里。

**Q：多人联机如何使用？**
A：在决策模式选择页点击「邀请朋友一起选」按钮，复制生成的链接发给朋友，等所有人加入等待室后，发起人点击开始决策。需确保 `.env` 中的 `APP_BASE_URL` 设置为可被朋友访问的地址。

**Q：部署到公网后多人功能不可用？**
A：检查 `APP_BASE_URL` 是否已设置为实际域名/IP；确保服务器防火墙开放了 WebSocket 端口；Nginx 配置需要添加 WebSocket 升级头（详见 DEPLOY.md）。
