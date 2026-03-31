---
title: "Sprint Change Proposal: 多人投票重设计 + 用户认证"
type: sprint-change-proposal
date: "2026-03-30"
author: Friday
project: takeout_decision_maker
status: approved
changeScope: Moderate
---

# Sprint Change Proposal
> 外卖点餐决策器 | 制定日期：2026-03-30 | Scrum Master: Bob

---

## Section 1：问题描述

### 触发背景

当前多人决策功能（Epic 6）已在 Sprint 3 完整交付。然而在团建场景（如：公司团队一起投票选餐厅）的实际使用中，发现以下两个关键缺陷：

1. **多人决策玩法不匹配场景**：现有「转盘/扫雷」游戏化模式对团建投票场景体验割裂——参与者无法表达偏好，完全随机的结果缺乏认同感。真实团建需要「每人投一票，票多者胜」的公平投票机制。

2. **缺乏用户身份体系**：系统目前硬编码 `user_id=1` 单用户，多人场景下所有参与者无法有独立的餐厅库和历史记录。若要支持真实多用户使用，必须引入注册/登录体系。

### 变更来源

来自产品负责人 Friday 基于真实使用场景的需求升级，非技术缺陷。

---

## Section 2：影响分析

### Epic 影响

| Epic | 影响级别 | 说明 |
|------|----------|------|
| Epic 6 多人协作 | 🔴 重大 | 7/12 Stories 需修改或删除，2 Stories 新增 |
| Epic 1 餐厅库管理 | 🟡 中等 | DB 迁移 + 认证中间件替换 |
| Epic 2 转盘决策 | ✅ 无影响 | 单人转盘完整保留 |
| Epic 3 扫雷决策 | ✅ 无影响 | 单人扫雷完整保留 |
| Epic 4 设置 | ✅ 无影响 | |
| Epic 5 历史过滤 | 🟡 轻微 | userId 来源从 header 改为 JWT token |
| Epic 7 上线就绪 | 🟡 轻微 | 补充 auth 相关错误处理 |
| **Epic 8（新增）** | 🆕 全新 | 用户注册/登录，6 个 Stories |

### Story 级别影响（Epic 6）

| Story | 现状 | 变更动作 |
|-------|------|----------|
| 6.1 WS 骨架 | done | ✅ 保留不变 |
| 6.2 创建会话 API | done | 🔄 重写：移除 mode 参数，增加 selectedRestaurantIds + deadlineAt |
| 6.3 分享链接前端 | done | 🔄 重写：移除模式选卡，改为餐厅勾选 + 截止时间设置 |
| 6.4 加入会话 API | done | ✅ 基本保留，轻微调整 |
| 6.5 昵称输入页 | done | ✅ 基本保留 |
| 6.6 等待室 | done | ✅ 保留 |
| 6.7 WS 等待室事件 | done | ✅ 保留 |
| 6.8 开始决策广播 | done | 🔄 修改：移除 mode 字段 |
| **6.9 多人转盘** | done | ❌ 删除（代码清理） |
| **6.10 多人扫雷** | done | ❌ 删除（代码清理） |
| 6.11 多人结果页 | done | 🔄 重写：基于投票结果 |
| 6.12 断线重连 | done | ✅ 保留 |
| **6.9-new 投票机制** | — | 🆕 新增：投票 API + WS 事件 |
| **6.10-new 投票前端** | — | 🆕 新增：投票列表页 UI |

### Artifact 冲突汇总

**PRD 冲突（需更新）：**
- FR-16：候选快照逻辑改为自选 + 截止时间
- FR-17：受邀者仍用昵称，但明确发起人需登录身份
- FR-19：移除转盘/扫雷多人模式，替换为投票机制
- FR-20（新增）：用户注册/登录需求

**架构冲突（需更新）：**
- users 表：新增 `email`, `password_hash`, `is_temp` 字段
- decision_sessions 表：移除 `mode`，新增 `deadline_at`
- decision_history 表：`mode` ENUM 新增 `'vote'` 值
- WS 状态机：移除 `spin_submitted` / `cell_clicked`，新增 `vote_submitted` / `vote_result`
- 认证中间件：`X-User-Id header` → `Authorization: Bearer <JWT>`

**UX 冲突（需更新）：**
- 多人决策页：转盘/扫雷 UI → 投票列表 UI
- 新增登录/注册页面
- api.js：硬编码 userId → JWT Token 注入

---

## Section 3：推荐方案

### 选定路径：Hybrid（局部清理 + 直接调整 + 新 Epic）

```
Phase 1：代码清理
  └─ 删除多人转盘（Story 6.9）、多人扫雷（Story 6.10）相关代码

Phase 2：Epic 6 重设计（Sprint 4 前半）
  ├─ 修改：Story 6.2 / 6.3 / 6.8 / 6.11
  └─ 新增：Story 6.9-new（投票后端）/ 6.10-new（投票前端）

Phase 3：Epic 8 用户认证（Sprint 4 后半，可并行）
  └─ 8.1 DB迁移 → 8.2 注册API → 8.3 登录API
     → 8.4 JWT中间件替换 → 8.5 前端登录页 → 8.6 Token管理
```

### 选择理由

| 考量 | 说明 |
|------|------|
| 复用最大化 | WS 骨架、等待室、断线重连、分享链接全部保留，不浪费 Sprint 3 成果 |
| 风险可控 | Auth 独立 Epic，单人功能完全不受影响 |
| 交付清晰 | 两条并行线可分别追踪进度 |
| 不回滚业务逻辑 | 仅清理游戏模式代码（无业务损失） |

### 工作量与风险

| 维度 | 评估 |
|------|------|
| 总工作量 | 高（约 1 Sprint = 2 周） |
| 技术风险 | 中（JWT auth 成熟方案；DB 迁移需回归测试） |
| 业务风险 | 低（单人功能不受影响，多人功能重建） |

---

## Section 4：详细变更提案

### 变更 A：多人决策重设计

---

**[A1] Story 6.2 — 创建会话 API**

```
Story: 6.2 创建会话 API + 候选快照
Section: 功能描述 + Acceptance Criteria

OLD:
- POST /api/sessions {mode: "wheel" | "minesweeper"}
- candidate_snapshot = 发起人全量餐厅列表（展开权重）
- 返回：{shareToken, sessionId, expiresAt}

NEW:
- POST /api/sessions {selectedRestaurantIds: [1,2,3,...], deadlineAt: "2026-03-30T18:00:00Z"}
- selectedRestaurantIds 必须为发起人餐厅库的子集，最少2家，最多20家
- deadlineAt 必须大于当前时间，最长7天
- candidate_snapshot 仅包含用户选定的餐厅
- 返回：{shareToken, sessionId, expiresAt, deadlineAt}
- decision_sessions 表移除 mode 字段，新增 deadline_at 字段

Rationale: 团建场景需要发起人控制候选范围，超时机制改为明确截止时间点
```

---

**[A2] Story 6.3 — 分享链接前端**

```
Story: 6.3 分享链接生成与复制
Section: 功能描述

OLD:
- 点击「邀请朋友」→ 弹出模式选择卡片（转盘/扫雷）→ 创建会话

NEW:
- 点击「发起投票」→ 进入餐厅勾选页（显示发起人全部餐厅，默认全选）
- 勾选 2~20 家餐厅 → 设置截止时间（默认今天晚上 20:00）→ 创建会话
- 勾选数 < 2 时「创建」按钮置灰，提示"至少选2家"
- 创建后生成分享链接，一键复制

Rationale: 移除游戏模式选择，改为更直观的餐厅选择 + 截止时间设置
```

---

**[A3] Story 6.8 — 开始决策广播**

```
Story: 6.8 开始决策广播
Section: WS 事件 data 结构

OLD:
broadcast deciding_started: {status:"deciding", mode:"wheel"|"minesweeper", candidateSnapshot:[...]}

NEW:
broadcast deciding_started: {status:"deciding", candidateSnapshot:[...], deadlineAt:"..."}

Rationale: 移除 mode 字段（不再有游戏模式），新增 deadlineAt 供前端倒计时展示
```

---

**[A4] Story 6.9（删除）— 多人转盘**

```
Story: 6.9 多人转盘
动作: ❌ 删除

清理内容：
- 删除前端：多人转盘 Canvas 渲染代码、spin 相关 WS 事件处理
- 删除后端：handleSpinSubmitted()、startSpinRound() 函数
- 删除 WS 事件：spin_submitted、round_result、tie_break_start、no_result

Rationale: 团建投票场景不需要游戏化机制，以投票机制替代
```

---

**[A5] Story 6.10（删除）— 多人扫雷**

```
Story: 6.10 多人扫雷
动作: ❌ 删除

清理内容：
- 删除前端：多人扫雷格子 UI、cell_clicked WS 处理
- 删除后端：handleCellClicked()、deciding_locked 状态逻辑
- 删除 WS 事件：cell_clicked、result_revealed

Rationale: 同 A4，以投票机制替代
```

---

**[A6] Story 6.9-new（新增）— 投票机制后端**

```
Story: 6.9-new 投票 API + WebSocket 事件
动作: 🆕 新增

Acceptance Criteria:
- POST /api/sessions/:token/vote {restaurantId, restaurantName}
  → 记录该用户的投票（每人仅限投1票，重复投票覆盖）
  → 广播 {event:"vote_updated", data:{votes:[{restaurantId, count}], totalVoters, votedCount}}
- 截止时间到达时（由发起人手动触发 OR 自动触发）：
  → 统计最高票餐厅 → 广播 {event:"vote_result", data:{winner, allVotes, isTie}}
  → 平局时随机选一个
- GET /api/sessions/:token/votes → 返回当前实时票数

Rationale: 核心投票功能后端实现
```

---

**[A7] Story 6.10-new（新增）— 投票前端页**

```
Story: 6.10-new 投票前端页面
动作: 🆕 新增

Acceptance Criteria:
- 进入 /session/:token/decide 后显示候选餐厅列表（来自 candidateSnapshot）
- 每位参与者点选一家餐厅，按钮高亮选中状态，可修改
- 实时展示投票进度（如「3/5人已投票」）和票数统计（实名或匿名由发起人决定）
- 发起人额外显示「结束投票」按钮，可提前结束
- 截止时间倒计时展示
- 投票结束后展示结果页：最高票餐厅大字显示 + 完整票数分布

Rationale: 投票 UI，替代原转盘/扫雷游戏界面
```

---

**[A8] Story 6.11 — 多人结果页**

```
Story: 6.11 多人结果页与会话确认
Section: 结果展示逻辑

OLD:
- 转盘/扫雷揭晓动效 → 发起人「就这家了！」/ 其他人「等待确认」

NEW:
- 投票结果页：最高票餐厅大字居中显示
- 票数分布：所有候选餐厅 + 各自得票数
- 发起人：「就这家了！」（写历史 + 会话状态 done）+ 「重新投票」（扣重玩次数）
- 其他参与者：「等待发起人确认...」
- 平局情况：显示「平局！系统随机选择了 XXX」

Rationale: 基于投票结果展示，移除游戏揭晓动效
```

---

### 变更 B：用户注册/登录系统（新 Epic 8）

---

**[B1] Story 8.1 — DB 迁移**

```
Story: 8.1 数据库迁移：用户认证字段
动作: 🆕 新增

OLD (users 表):
CREATE TABLE users (id, name VARCHAR(50), created_at)

NEW (users 表 ALTER):
ALTER TABLE users ADD COLUMN email VARCHAR(100) UNIQUE NULL;
ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN is_temp BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN updated_at DATETIME;

decision_sessions 表：
ALTER TABLE decision_sessions DROP COLUMN mode;
ALTER TABLE decision_sessions ADD COLUMN deadline_at DATETIME;

decision_history 表：
ALTER TABLE decision_history MODIFY COLUMN mode ENUM('wheel','minesweeper','vote');

Rationale: 最小化迁移，保留历史数据兼容性
```

---

**[B2] Story 8.2 — 注册 API**

```
Story: 8.2 用户注册 API
动作: 🆕 新增

POST /api/auth/register {name, email, password}
→ email 格式校验，密码最少8位
→ bcrypt hash 密码，写入 users 表（is_temp=false）
→ 返回 {userId, name, email, token（JWT）}
→ 重复 email → 409
```

---

**[B3] Story 8.3 — 登录 API**

```
Story: 8.3 用户登录 API
动作: 🆕 新增

POST /api/auth/login {email, password}
→ 查找用户 → bcrypt.compare → 生成 JWT（payload: userId, exp: 7天）
→ 返回 {token, userId, name}
→ 密码错误 → 401
```

---

**[B4] Story 8.4 — JWT 中间件替换**

```
Story: 8.4 JWT 认证中间件
动作: 🆕 新增

OLD:
// middleware/auth.js
req.userId = req.headers['x-user-id'] || 1;

NEW:
// middleware/auth.js
const token = req.headers.authorization?.split(' ')[1];
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.userId = decoded.userId;
→ token 无效/过期 → 401

.env.example 新增：JWT_SECRET=your-secret-key-here
```

---

**[B5] Story 8.5 — 前端登录/注册页**

```
Story: 8.5 前端登录/注册页
动作: 🆕 新增

- /login 页：email + 密码输入，登录按钮，跳转到首页
- /register 页：name + email + 密码，注册按钮
- 登录成功 → token 存入 localStorage，页面跳转首页
- 未登录访问受保护页面 → 重定向 /login
- 顶部导航显示已登录用户名 + 退出按钮
```

---

**[B6] Story 8.6 — 前端 Token 管理**

```
Story: 8.6 前端 Token 管理（api.js 重构）
动作: 🔄 修改（Story 1.4 关联）

OLD (scripts/api.js):
headers: { 'X-User-Id': 1 }

NEW:
headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
→ 401 响应自动清除 token，重定向 /login
→ token 不存在时直接重定向 /login

Rationale: 统一认证机制，不再硬编码 userId
```

---

## Section 5：实施交接计划

### 变更规模：Moderate

需要 PO（Friday）+ SM 协调 Sprint 4 规划，但不需要从零重新规划整个产品。

### Sprint 4 规划建议

| 阶段 | Stories | 工作量 |
|------|---------|--------|
| P1 代码清理 | 删除 6.9 / 6.10 实现 | 0.5天 |
| P2 Epic 6 重设计 | 修改 6.2/6.3/6.8/6.11 + 新增 6.9-new/6.10-new | ~8天 |
| P3 Epic 8 Auth | 8.1~8.6 | ~6天 |
| 总计 | 14 Stories（含修改）| ~14天（1 Sprint） |

### 成功标准

- [ ] 多人投票：发起人可选择候选餐厅 + 设定截止时间
- [ ] 多人投票：参与者可实时看到票数，截止时自动公布结果
- [ ] 用户注册/登录：注册用户有独立餐厅库和历史
- [ ] 受邀者仍可用昵称免注册加入投票
- [ ] 单人转盘/扫雷功能不受任何影响
- [ ] 所有 API 完成 JWT 认证迁移

### 交接责任人

| 角色 | 责任 |
|------|------|
| Friday（PO） | 批准本提案，确认优先级 |
| 开发团队（DS） | 执行 Phase 1~3 |
| SM | 更新 Sprint Plan + Epic 文档 |

---

## 待办（批准后执行）

- [ ] 更新 PRD（FR-16/17/19 + 新增 FR-20）
- [ ] 更新 Architecture 文档（DB schema + 认证机制 + WS 状态机）
- [ ] 更新 Epics 文档（Epic 6 重写 + 新增 Epic 8）
- [ ] 更新 Sprint Plan（新增 Sprint 4）
- [ ] 代码清理（删除 6.9/6.10 实现）
- [ ] 开始 Story 开发循环（bmad-create-story → bmad-dev-story）
