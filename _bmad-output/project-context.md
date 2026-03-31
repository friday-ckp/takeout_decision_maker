---
project_name: 'takeout_decision_maker'
user_name: 'Friday'
date: '2026-03-31'
sections_completed:
  - technology_stack
  - language_rules
  - framework_rules
  - testing_rules
  - quality_rules
  - workflow_rules
  - anti_patterns
status: 'complete'
rule_count: 42
optimized_for_llm: true
---

# Project Context for AI Agents

_本文件包含 AI Agent 在实现代码时必须遵守的关键规则和模式，重点是 Agent 容易遗漏的非直觉性细节。_

---

## 技术栈 & 版本

### 后端
- Node.js + Express ^4.19.2（CommonJS 模块系统）
- mysql2 ^3.9.7（Promise 连接池，connectionLimit=10）
- ws ^8.17.0（WebSocket 服务器）
- jsonwebtoken ^9.0.3（JWT 认证）
- bcryptjs ^3.0.3（密码哈希）
- uuid ^9.0.1（requestId / 会话 token）
- dotenv ^16.4.5

### 前端
- 原生 HTML5 / CSS3 / Vanilla JavaScript（无框架、无构建工具）
- Canvas API（转盘绘制）、WebSocket API（多人实时）、localStorage（Token 存储）

### 数据库
- MySQL 8.0+（InnoDB，使用事务）

### 测试
- Jest ^29.7.0 + Supertest ^7.2.2，nodemon ^3.1.0（开发）

---

## Critical Implementation Rules

### 语言特定规则

- **模块系统**：全项目 CommonJS（`require` / `module.exports`），禁用 ES Module（`import/export`）
- **异步处理**：所有 controller 用 `async/await` + `try/catch`，`catch` 末尾必须调用 `next(err)`
- **错误响应**：成功用 `success(res, data)`，业务失败用 `fail(res, errorCode, message, httpStatus)`——均来自 `utils/response.js`，禁止直接 `res.json()`
- **系统错误**：`throw err` 或 `next(err)` 传给全局 `errorHandler`，统一返回 `{code:50001}`
- **JSON 字段**：`tags` 存 JSON 字符串，读取后必须 `safeParseJSON(r.tags, [])`；写入前必须 `JSON.stringify(tags)`
- **布尔转换**：MySQL 返回 0/1，需 `!!r.isFavorite` 转布尔
- **SQL 安全**：所有查询用 `?` 参数化，禁止字符串拼接

### 框架特定规则

#### Express 后端

- **路由结构**：路由文件只做 HTTP 映射，业务逻辑全在 `controllers/`
- **路由顺序**：具体路径（`/import`、`/trash`、`/blacklist`）必须在 `/:id` 路由**前面**声明
- **认证挂载**：需要登录的路由在 router 顶部 `router.use(requireAuth)`；可选登录用 `optionalAuth`
- **SPA fallback**：非 `/api` 路径统一返回 `frontend/pages/index.html`

#### 前端 SPA

- **页面切换**：用 `navigate(pageId)`，不用 `<a href>`；页面 DOM id 格式为 `page-${pageId}`
- **Auth guard**：新增需登录页面必须加入 `PROTECTED_PAGES` 数组（`scripts/app.js`）
- **API 调用**：必须用 `api.get/post/put/delete`（`scripts/api.js`），不得裸用 `fetch`
- **UI 反馈**：统一用 `showToast(message, type)`，type 为 `''` / `'success'` / `'error'`
- **CSS 缓存**：样式文件通过 `?v=N` 查询参数控制版本

#### WebSocket

- **连接 URL**：`ws://host/ws/sessions?token=xxx&nickname=Alice&userId=1`
- **消息格式**：`{ event: 'event_name', data: {...} }`
- **广播工具**：`broadcast(token, payload)` 全量广播；`broadcastExcept(token, excludeWs, payload)` 排除自身
- **状态检查**：发送前必须检查 `ws.readyState === ws.OPEN`
- **房间存储**：内存 `Map`（单进程），重启后状态丢失

### 测试规则

- **目录结构**：`tests/unit/`（纯函数）/ `tests/integration/`（HTTP API）/ `tests/ws-stress.test.js`
- **DB Mock**：集成测试必须 mock `../../src/models/db`：
  ```js
  jest.mock('../../src/models/db', () => ({
    pool: { query: jest.fn() },
    testConnection: jest.fn().mockResolvedValue(),
  }));
  ```
- **Mock 顺序**：`pool.query.mockResolvedValueOnce()` 按 controller 中 SQL 调用顺序依次 mock
- **外部依赖**：bcryptjs、jsonwebtoken 也需 mock
- **命名规范**：`describe` 用 `'POST /api/auth/register'`；`test` 用 `'条件 → 期望结果'`
- **测试数据**：复用数据用工厂函数（如 `makeCandidates()`）
- **清理**：每个测试文件必须声明 `afterEach(() => jest.clearAllMocks())`
- **执行**：`cd backend && npm test`（含 `--forceExit` 防进程残留）

### 代码质量 & 风格规则

- **文件命名**：后端控制器 `camelCase + Controller`（如 `restaurantsController.js`）；前端脚本 `kebab-case`
- **CSS 变量**：颜色/间距/字体必须用 `variables.css` 中的 CSS 自定义属性，禁止硬编码值
- **注释规范**：文件顶部标注 Story 编号；段落分隔用 `// ── 描述 ─────` 装饰线
- **迁移脚本**：放 `backend/migrations/`，必须可重复执行（`CREATE TABLE IF NOT EXISTS`）
- **迁移连接**：使用独立连接（非连接池），加 `multipleStatements: true`
- **环境变量**：新增配置必须同步更新 `backend/.env.example`
- **日志格式**：`console.error('[Error] RequestId=${req.requestId} ${err.message}', err.stack)`

### 开发工作流规则

- **分支命名**：`story/{story-id}-{kebab-case-title}`（如 `story/8-4-jwt-middleware`）
- **Commit 格式**：`type(scope): 描述`，scope 用 Story 编号（如 `feat(8.6): ...`）
- **PR 规范**：每个 Story 一个 PR，合并到 main
- **部署方式**：生产用 Kubernetes，配置文件在 `k8s/`（按 `0N-*.yaml` 顺序）
- **敏感配置**：密码/密钥统一在 Nacos 维护（`http://nacos.test.huaqing.run`，Namespace: `local_ckp`）
- **禁止提交**：`backend/.env`、`node_modules/`、`*.log`、`coverage/`

### 关键禁忌规则

#### 安全红线
- ❌ **SQL 注入**：禁止字符串拼接 SQL，必须用 `?` 参数化
- ❌ **跨用户数据泄露**：所有查询必须带 `WHERE user_id = req.userId`，这是最高优先级安全规则
- ❌ **JWT 密钥**：生产环境必须设置 `JWT_SECRET`，默认 `'dev-secret'` 无安全性

#### 实现陷阱
- ❌ 前端直接 `fetch()` → Token 不会注入，401 不会自动处理
- ❌ 新增需登录页面忘记加入 `PROTECTED_PAGES` → 未登录可直接访问
- ❌ `tags` 读取后未 `safeParseJSON` → 返回字符串而非数组，前端报错
- ❌ 路由 `/:id` 在 `/import` 前 → `/import` 被当作 id 处理，404

#### 认证中间件选择
- 强制登录 → `requireAuth`（未登录 401）
- 登录/匿名均可 → `optionalAuth`（`req.userId` 可能为 null，业务层需判断）
- WS 连接不过 HTTP 中间件 → 需手动验证 `token` 查询参数

#### 数据库特殊处理
- MySQL 8 `ALTER TABLE ADD COLUMN` 无 `IF NOT EXISTS`，需先查 `INFORMATION_SCHEMA` 或用条件 PROCEDURE
- 软删除过滤（`is_deleted = 0`）仅适用于餐厅表，其他资源无此逻辑

---

## 使用说明

**For AI Agents：**
- 实现任何代码前先读本文件
- 严格遵守所有规则，尤其是安全红线
- 如有疑问，选择更严格的实现方式
- 发现新模式时更新本文件

**For Humans：**
- 保持内容精简，聚焦 Agent 需要的信息
- 技术栈变更时同步更新
- 定期审查，移除已过时的规则

Last Updated: 2026-03-31
