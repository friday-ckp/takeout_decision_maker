---
title: "Epics & Stories: takeout_decision_maker"
type: epics
phase: 3-solutioning
status: complete
stepsCompleted: [1, 2, 3]
created: "2026-03-27"
updated: "2026-03-27"
author: Friday
project: takeout_decision_maker
inputDocuments:
  - _bmad-output/planning-artifacts/prd-takeout_decision_maker.md
  - _bmad-output/planning-artifacts/architecture-takeout_decision_maker.md
  - _bmad-output/planning-artifacts/ux-design-takeout_decision_maker.md
  - _bmad-output/planning-artifacts/api-design-takeout_decision_maker.md
---

# takeout_decision_maker - Epic Breakdown

## Overview

本文档将 PRD、UX 设计和架构需求分解为可实施的 Epics 和 Stories，供开发团队按 Sprint 执行。

---

## Requirements Inventory

### Functional Requirements

FR-00: 首次使用空状态引导 — 餐厅数量 < 2 时，首页显示引导提示 + 「去添加餐厅」按钮；通过分享链接进入时不触发
FR-01: 决策入口 — 首屏显示「开始决策」按钮，右上角心情 icon
FR-02: 决策模式选择 — 展示转盘/扫雷两种模式卡片，含多人入口预留
FR-03: 转盘决策 — 等分扇区（收藏2倍），旋转动画2~4秒，候选上限16，超出时展示勾选界面，每日重玩次数限制
FR-04: 扫雷决策 — N个翻扣格子（收藏2格，上限12），先到先得，翻牌动画，支持再来一次
FR-05: 添加餐厅 — 手动添加（名称必填，最长100字符/品类/备注），支持JSON批量导入（上限100条，错误处理）
FR-06: 编辑餐厅 — 可修改名称、品类、口味标签、备注
FR-07: 删除餐厅 — 软删除进回收站，7天惰性清理，支持恢复
FR-08: 收藏餐厅 — 收藏标记，转盘/扫雷中2倍概率，收藏列表页
FR-09: 拉黑餐厅 — 永久排除出候选，黑名单页，支持解除，拉黑时自动清除收藏
FR-10: 决策历史 — 确认后记录餐厅名/模式/时间，展示最近30条
FR-11: 历史排除 — 决策前可排除N天内吃过的（默认3天），候选不足时降级
FR-12: 心情选择器 — 首页右上角4种心情，过滤型（😴😤）+ 排序型（😊😐），跨日清空
FR-13: 口味偏好 — 模式选择页口味标签（重口/清淡/咸/甜/随意），候选不足时降级
FR-14: 全局设置 — 每日重玩上限（默认3）、历史排除天数（默认3），持久化
FR-15: 决策结果展示 — 大字显示餐厅名，品类/备注，「就这家了！」（写历史）+ 「换一个」（扣次数）；多人模式发起人/参与者行为差异
FR-16: 生成分享链接 — 创建会话返回 share_token，候选快照，有效期24小时
FR-17: 加入决策会话 — 受邀者输入昵称加入，创建临时user记录，7天后惰性清理
FR-18: 实时等待室 — 发起人看参与者列表（WebSocket推送），发起人点「开始决策」触发同步进入
FR-19: 多人同步决策 — 转盘仅发起人可旋转，扫雷任意人可点击（服务端先到先得），结果广播，发起人确认后写历史+会话状态变done

### NonFunctional Requirements

NFR-01: 首屏加载 < 2秒（本地网络）
NFR-02: 单人决策 API 响应 < 500ms（P95）
NFR-03: WebSocket 广播延迟 < 500ms（局域网）
NFR-04: 单会话最大参与人数：10人
NFR-05: 断线自动重连，最大间隔5秒，重连后同步最新会话状态
NFR-06: 首次使用需完成数据库配置（一次性向导，约1分钟）
NFR-07: MySQL连接信息通过环境变量管理，不硬编码到代码
NFR-08: 桌面端 Chrome / Firefox / Safari 最新版本兼容
NFR-09: 移动端最小宽度375px下布局正常（响应式）
NFR-10: 高UI设计质量，视觉精良，避免通用AI审美

### Additional Requirements

来自架构设计的技术要求：

- ARCH-01: 数据库初始化脚本创建8张表：users, restaurants, user_restaurant_relations, decision_history, daily_config, settings, decision_sessions, session_participants
- ARCH-02: 默认创建 user_id=1 的单用户记录（初始化脚本）
- ARCH-03: 后端骨架：Node.js + Express，路由/控制器/模型/中间件分层目录结构
- ARCH-04: WebSocket 服务器（ws@8.x），房间状态存内存 Map（单进程）
- ARCH-05: 惰性触发机制（无 cron 任务）：回收站清理、跨日重置 replay_count、临时用户清理
- ARCH-06: 候选快照：会话创建时序列化发起人候选餐厅 ID 列表存入 decision_sessions.candidate_snapshot
- ARCH-07: 前端静态文件（无框架/无构建工具），通过 Express 静态托管
- ARCH-08: .env 文件管理所有敏感配置，提供 .env.example

### UX Design Requirements

来自 UX 设计文档的交互需求：

- UX-DR1: 首页「开始决策」大按钮居中，空状态时替换为引导插图 + 引导文案 + 「去添加餐厅」按钮
- UX-DR2: 转盘候选 > 16 时，展示勾选界面（以餐厅为单位，默认全选，勾选数 < 2 按钮置灰）
- UX-DR3: 转盘 Canvas 渲染：等分扇区，收藏餐厅视觉上更宽（2倍角度），指针高亮结果扇区
- UX-DR4: 扫雷格子网格布局，CSS 3D 翻转动画（300~500ms），背面统一样式，正面显示餐厅名
- UX-DR5: 结果页：餐厅名称大字居中（主视觉），品类/备注次要展示，「就这家了！」绿色主按钮，「换一个」次要按钮含剩余次数提示
- UX-DR6: 心情 icon 首页右上角，已选心情有视觉标记，点击展开表情面板
- UX-DR7: 等待室页面实时展示参与者昵称列表，新成员加入有动效
- UX-DR8: 全局：圆角卡片风格，桌面优先响应式，系统默认中文字体

### FR Coverage Map

| 需求 | Epic | 说明 |
|------|------|------|
| FR-00 | Epic 1 | 空状态引导 |
| FR-05 | Epic 1 | 添加餐厅 + 批量导入 |
| FR-06 | Epic 1 | 编辑餐厅 |
| FR-07 | Epic 1 | 软删除 / 回收站 |
| FR-08 | Epic 1 | 收藏（2倍权重）|
| FR-09 | Epic 1 | 拉黑餐厅 |
| FR-01 | Epic 2 | 首页决策入口 |
| FR-02 | Epic 2 | 模式选择页 |
| FR-03 | Epic 2 | 转盘决策 |
| FR-15 | Epic 2 | 结果页（转盘模式）|
| FR-04 | Epic 3 | 扫雷决策 |
| FR-14 | Epic 4 | 全局设置 |
| FR-10 | Epic 5 | 决策历史 |
| FR-11 | Epic 5 | 历史排除 |
| FR-12 | Epic 5 | 心情选择器 |
| FR-13 | Epic 5 | 口味偏好 |
| FR-16 | Epic 6 | 生成分享链接 |
| FR-17 | Epic 6 | 加入会话 |
| FR-18 | Epic 6 | 等待室 |
| FR-19 | Epic 6 | 多人同步决策 |
| NFR全部 | Epic 7 | 性能、兼容性、移动端、错误处理 |
| ARCH-01~08 | Epic 1 | 基础设施（含系统初始化）|

---

## Epic List

### Epic 1: 餐厅库管理
用户能建立、维护和管理自己的常用餐厅候选池（含系统初始化与基础设施）。
**FRs covered:** FR-00, FR-05, FR-06, FR-07, FR-08, FR-09 + ARCH-01~08

### Epic 2: 转盘决策流程
用户能通过转盘模式完成完整的单人决策流程并查看、确认结果。
**FRs covered:** FR-01, FR-02, FR-03, FR-15（转盘）

### Epic 3: 扫雷决策流程
用户能通过扫雷模式选出今天吃什么，体验游戏化决策。
**FRs covered:** FR-04, FR-15（扫雷补充）

### Epic 4: 个性化设置
用户能自定义工具行为（每日重玩次数、历史排除天数）。
**FRs covered:** FR-14

### Epic 5: 历史沉淀与智能过滤
用户能查看决策历史、排除近期餐厅、按心情/口味过滤候选池。
**FRs covered:** FR-10, FR-11, FR-12, FR-13

### Epic 6: 多人实时协作决策
用户能邀请朋友通过分享链接加入会话，实时一起用转盘/扫雷做决策。
**FRs covered:** FR-16, FR-17, FR-18, FR-19

### Epic 7: 上线就绪与质量打磨
产品达到可上线的质量标准（性能优化、兼容性、移动端适配、全局错误处理）。
**FRs covered:** NFR-01~10

---

## Epic 1: 餐厅库管理

用户能建立、维护和管理自己的常用餐厅候选池，包含完整的系统初始化。

> **职责说明：** Stories 1.1~1.4 为系统基础设施（项目骨架、数据库、后端框架、前端框架），与餐厅业务功能无直接关联。将其归入 Epic 1 的原因是：Sprint 1 中这些基础设施是餐厅管理功能的前置依赖，合并可简化 Sprint 执行跟踪。Epic 1 的"业务价值完成度"以 Stories 1.5~1.18 的完成情况评估，1.1~1.4 为基础设施任务单独追踪。

### Story 1.1: 项目骨架初始化与环境配置

As a 开发者,
I want 一个完整的项目目录结构和 .env 配置示例,
So that 团队能快速启动本地开发环境。

**Acceptance Criteria:**

**Given** 一个空的项目根目录
**When** 执行 `npm install` 并复制 `.env.example` 为 `.env` 填入数据库信息后运行 `node src/index.js`
**Then** 服务启动成功，控制台输出监听端口信息（默认 3000）
**And** 访问 `http://localhost:3000` 返回前端首页 HTML

**Given** `.env` 中 DB 配置错误
**When** 启动服务
**Then** 控制台输出明确的数据库连接错误信息并退出进程（exit code 1），不显示堆栈跟踪给用户
**And** 具体错误消息格式见 Story 7.7（Sprint 3 打磨阶段完善）

---

### Story 1.2: 数据库初始化脚本（DDL Migrations）

As a 开发者,
I want 一个可重复执行的数据库初始化脚本,
So that 任何人都能一键建表并初始化默认数据。

**Acceptance Criteria:**

**Given** 一个空的 MySQL 数据库
**When** 执行 `node migrations/init.js`
**Then** 成功创建8张表：users, restaurants, user_restaurant_relations, decision_history, daily_config, settings, decision_sessions, session_participants
**And** `session_participants` 表包含 `role` 字段（枚举值：`'host'` / `'guest'`），用于区分发起人与受邀者
**And** 创建唯一约束：user_restaurant_relations(user_id, restaurant_id)，daily_config(user_id, date)，settings(user_id, key)

**Given** 数据库表已存在
**When** 再次执行初始化脚本
**Then** 脚本不报错，使用 `IF NOT EXISTS` 跳过已存在的表

**Given** 初始化完成
**When** 查询 users 表
**Then** 存在 id=1 的默认用户记录（name='默认用户'）

---

### Story 1.3: Express 后端骨架（路由 / 中间件 / 连接池）

As a 开发者,
I want 一个结构清晰的 Express 后端骨架,
So that 后续 API 开发有统一规范和错误处理基础。

**Acceptance Criteria:**

**Given** 后端服务启动
**When** 发起任意 API 请求
**Then** 响应头包含 `X-Request-Id`，响应体符合统一格式 `{code, message, data}`

**Given** 请求缺少 `X-User-Id` 请求头
**When** 调用需要用户身份的 API
**Then** 返回 `{code: 40001, message: "缺少 X-User-Id"}` 的 400 响应

**Given** 服务内部发生未捕获异常
**When** API 被调用
**Then** 返回 `{code: 50001, message: "服务器内部错误"}` 的 500 响应，不泄露堆栈信息
**And** 错误详情记录到 console.error

**Given** 项目根目录的 `package.json`
**When** 执行 `npm test`
**Then** 测试命令不报错，至少包含1个通过的单元测试（测试框架使用 Jest 或 Mocha，测试文件位于 `backend/tests/` 目录）
**And** 为 Story 7.6 的"API 异常路径测试覆盖"提供基础测试脚手架

---

### Story 1.4: 前端静态文件框架（HTML / CSS / JS 基础样式）

As a 用户,
I want 打开页面时看到一个视觉精良的基础界面框架,
So that 后续所有页面都有一致的视觉风格基础。

**Acceptance Criteria:**

**Given** 访问 `http://localhost:3000`
**When** 页面加载完成
**Then** 显示基础导航结构（底部导航栏：首页/餐厅/历史/设置）
**And** 字体、主色调、间距等 CSS 变量已定义在 `:root` 中
**And** 页面在 1440px 和 375px 宽度下均无布局错乱

**Given** 页面加载
**When** 检查 CSS
**Then** 使用系统默认中文字体栈，圆角卡片风格，高设计质量（非通用 AI 审美）

**Given** 前端 JS 模块初始化
**When** 加载公共 API 工具函数（`scripts/api.js` 或同等模块）
**Then** 所有后端 API 请求通过统一封装的 `apiFetch(path, options)` 函数发出
**And** 该函数自动注入请求头 `X-User-Id: 1`，调用方无需每次手动传入
**And** 单元测试或集成测试可验证：调用 `apiFetch` 发出的请求中包含 `X-User-Id: 1` header

---

### Story 1.5: 获取餐厅列表 API

As a 用户,
I want 系统能返回我的餐厅列表,
So that 前端能展示候选餐厅。

**Acceptance Criteria:**

**Given** 用户 id=1 有3条餐厅记录（含1条已软删除）
**When** `GET /api/restaurants` with header `X-User-Id: 1`
**Then** 返回2条记录（自动排除软删除），包含字段：id, name, category, tags(数组), note, isFavorite, createdAt, updatedAt
**And** 响应结构为 `{code:0, data:{total, page, limit, list}}`

**Given** 传入 `?keyword=海底`
**When** 调用列表 API
**Then** 只返回名称包含"海底"的餐厅

**Given** 传入 `?tags=辣,快`
**When** 调用列表 API
**Then** 只返回 tags 同时包含"辣"和"快"的餐厅

---

### Story 1.6: 餐厅列表页（前端）

As a 用户,
I want 在主页面看到我的餐厅列表,
So that 我能快速浏览和管理候选餐厅。

**Acceptance Criteria:**

**Given** 用户有餐厅数据
**When** 打开首页
**Then** 展示餐厅列表，每项显示：名称、品类标签、收藏图标、备注（若有）
**And** 显示餐厅总数量（如"共 8 家"）
**And** 列表支持滚动，无需分页

**Given** 列表加载中
**When** API 请求未完成
**Then** 显示 skeleton loading 占位

---

### Story 1.7: 空状态引导（FR-00）

As a 新用户,
I want 餐厅列表为空时看到引导提示,
So that 我知道如何开始使用工具。

**Acceptance Criteria:**

**Given** 用户餐厅数量为 0
**When** 打开首页
**Then** 展示空状态插图 + 引导文案"还没有餐厅，去添加一个吧~"
**And** 显示「去添加餐厅」按钮，「开始决策」按钮置灰

**Given** 用户餐厅数量为 1（<2）
**When** 打开首页
**Then** 「开始决策」按钮仍置灰，提示"至少需要2家餐厅才能开始决策"

**Given** 用户餐厅数量 ≥ 2
**When** 打开首页
**Then** 正常显示「开始决策」按钮，空状态引导消失

---

### Story 1.8: 添加单个餐厅 API（FR-05）

As a 用户,
I want 通过 API 添加一家新餐厅,
So that 该餐厅出现在我的候选池中。

**Acceptance Criteria:**

**Given** 有效请求体 `{name:"麦当劳", category:"快餐", tags:["快","便宜"], note:""}`
**When** `POST /api/restaurants`
**Then** 返回 201，响应体包含新创建餐厅的完整信息（含 id, createdAt）

**Given** `name` 为空字符串
**When** `POST /api/restaurants`
**Then** 返回 400，`{code:40001, message:"名称不能为空"}`

**Given** `name` 超过 100 字符
**When** `POST /api/restaurants`
**Then** 返回 400，`{code:40001, message:"名称最长100字符"}`

**Given** 同名餐厅已存在（同一 user_id）
**When** `POST /api/restaurants`
**Then** 返回 409，`{code:40901, message:"同名餐厅已存在"}`

**Given** `category` 超过50字符
**When** `POST /api/restaurants`
**Then** 返回 400，`{code:40001, message:"品类最长50字符"}`

**Given** `tags` 数组超过10个元素
**When** `POST /api/restaurants`
**Then** 返回 400，`{code:40001, message:"标签最多10个"}`

**Given** `tags` 中某个 tag 字符串超过20字符
**When** `POST /api/restaurants`
**Then** 返回 400，`{code:40001, message:"单个标签最长20字符"}`

**Given** `note` 超过500字符
**When** `POST /api/restaurants`
**Then** 返回 400，`{code:40001, message:"备注最长500字符"}`

---

### Story 1.9: 添加餐厅表单页（前端）

As a 用户,
I want 通过表单添加一家新餐厅,
So that 我不需要手动调用 API。

**Acceptance Criteria:**

**Given** 点击「去添加餐厅」或导航到餐厅管理页
**When** 页面加载
**Then** 展示添加表单：名称（必填输入框）、品类（选填）、口味标签（多选 chips）、备注（选填文本域）

**Given** 名称输入框为空时点击「保存」
**When** 表单提交
**Then** 名称输入框下方显示"请输入餐厅名称"错误提示，不发送网络请求

**Given** 填写合法信息后点击「保存」
**When** API 返回 201
**Then** 表单清空，列表刷新，toast 提示"添加成功"

---

### Story 1.10: JSON 批量导入 API（FR-05）

As a 用户,
I want 通过 JSON 批量导入多家餐厅,
So that 快速建立初始餐厅候选池。

**Acceptance Criteria:**

**Given** 合法 JSON `[{name:"A"},{name:"B",tags:["辣"]}]`
**When** `POST /api/restaurants/import`
**Then** 返回 200，`{code:0, data:{total:2, imported:2, skipped:0, skippedNames:[]}}`

**Given** JSON 中包含与已有餐厅同名的条目
**When** 调用导入 API
**Then** 跳过重复项，其余正常导入，响应中 skippedNames 列出被跳过的名称

**Given** JSON 中某条目缺少 name 字段
**When** 调用导入 API
**Then** 跳过该条目，响应中 skipped 计数+1，提示"Y条跳过（缺少名称）"

**Given** JSON 格式非法（非数组或语法错误）
**When** 调用导入 API
**Then** 整体拒绝，返回 400，`{code:40001, message:"JSON格式错误，请检查格式"}`

**Given** JSON 条目超过 100 条
**When** 调用导入 API
**Then** 只导入前 100 条，响应提示"已截断至100条上限"

---

### Story 1.11: JSON 批量导入前端 UI

As a 用户,
I want 在界面上粘贴 JSON 并一键导入,
So that 不需要使用 API 工具也能批量添加。

**Acceptance Criteria:**

**Given** 餐厅管理页
**When** 点击「批量导入」
**Then** 展示文本域（可粘贴 JSON）+ 格式说明示例 + 「确认导入」按钮

**Given** 输入非法 JSON 点击「确认导入」
**When** API 返回 400
**Then** 显示错误提示"JSON格式错误，请检查"，文本域内容不清空

**Given** 导入成功
**When** API 返回结果
**Then** 弹窗或 toast 显示摘要："成功导入 X 家，跳过 Y 家（重复/缺少名称）"
**And** 餐厅列表自动刷新

---

### Story 1.12: 编辑餐厅 API + 前端（FR-06）

As a 用户,
I want 修改已添加的餐厅信息,
So that 保持数据准确和最新。

**Acceptance Criteria:**

**Given** 合法请求体（部分字段）`{note:"周末人多"}`
**When** `PUT /api/restaurants/:id`
**Then** 只更新传入字段，其余字段不变，返回 200 含更新后完整数据
**And** updatedAt 字段更新为当前时间

**Given** 在前端点击餐厅条目的「编辑」按钮
**When** 进入编辑页
**Then** 表单预填当前信息，修改后点击「保存」调用 PUT API，成功后返回列表页并 toast 提示"修改成功"

**Given** 修改名称与另一家已有餐厅同名
**When** 调用 PUT API
**Then** 返回 409，前端显示"同名餐厅已存在"

**Given** 编辑请求中 `category`/`tags`/`note` 字段超过与 Story 1.8 相同的长度限制
**When** 调用 PUT API
**Then** 返回 400，错误码与 Story 1.8 一致（编辑路径不绕过字段验证）

---

### Story 1.13: 软删除餐厅 + 回收站 API（FR-07）

As a 用户,
I want 删除的餐厅进入回收站而非立即消失,
So that 误删后可以在7天内恢复。

**Acceptance Criteria:**

**Given** 一家正常餐厅
**When** `DELETE /api/restaurants/:id`
**Then** 返回 200，该餐厅设置 deleted_at 为当前时间，从正常列表消失

**Given** 访问 `GET /api/restaurants/trash`
**When** 用户有已软删除的餐厅
**Then** 返回软删除餐厅列表，每条显示 deletedAt
**And** 自动物理删除 deleted_at 超过7天的记录（惰性触发）

**Given** 回收站中的餐厅
**When** `POST /api/restaurants/:id/restore`
**Then** 清除 deleted_at，餐厅重新出现在正常列表

---

### Story 1.14: 回收站页面（前端）

As a 用户,
I want 在回收站页面查看并恢复误删的餐厅,
So that 不用担心误操作造成数据丢失。

**Acceptance Criteria:**

**Given** 进入回收站页面
**When** 有已软删除的餐厅
**Then** 列出餐厅名称 + 删除时间 + 「恢复」按钮

**Given** 点击「恢复」
**When** API 调用成功
**Then** 该条目从回收站列表移除，toast 提示"已恢复到餐厅列表"

**Given** 回收站为空
**When** 进入页面
**Then** 显示空状态"回收站为空"

---

### Story 1.15: 收藏 / 取消收藏（FR-08）

As a 用户,
I want 对喜欢的餐厅打上收藏标记,
So that 决策时它出现的概率更高。

**Acceptance Criteria:**

**Given** 一家未收藏的餐厅
**When** `POST /api/restaurants/:id/favorite`
**Then** 在 user_restaurant_relations 创建 relation_type='favorite' 记录，返回 `{isFavorite:true}`

**Given** 一家已收藏的餐厅
**When** 再次调用 `POST /api/restaurants/:id/favorite`
**Then** 删除该收藏记录，返回 `{isFavorite:false}`（toggle 行为）

**Given** 一家已拉黑的餐厅
**When** 调用收藏 API
**Then** 自动解除拉黑，建立收藏关系，返回 `{isFavorite:true, wasBlacklisted:true}`

**Given** 前端点击收藏 icon
**When** toggle 成功
**Then** icon 状态即时更新，无需刷新页面

---

### Story 1.16: 收藏列表页（前端）

As a 用户,
I want 单独查看所有收藏的餐厅,
So that 快速了解高权重候选。

**Acceptance Criteria:**

**Given** 进入收藏列表页（`/restaurants/favorites`）
**When** 用户有收藏餐厅
**Then** 展示所有收藏餐厅列表，样式与主列表一致
**And** 每项显示收藏标记 + 2倍权重说明文字

**Given** 收藏列表为空
**When** 进入页面
**Then** 显示空状态"还没有收藏的餐厅"

---

### Story 1.17: 拉黑 / 解除拉黑（FR-09）

As a 用户,
I want 永久拉黑踩雷餐厅,
So that 决策时它不再出现。

**Acceptance Criteria:**

**Given** 一家未拉黑的餐厅
**When** `POST /api/restaurants/:id/blacklist`
**Then** 创建 relation_type='blacklisted' 记录，若已收藏则删除收藏，返回 `{isBlacklisted:true}`

**Given** 一家已拉黑的餐厅
**When** 再次调用 blacklist API
**Then** 删除拉黑记录（解除拉黑），返回 `{isBlacklisted:false}`

**Given** 候选列表 API（`GET /api/candidates`）
**When** 调用
**Then** 已拉黑餐厅不出现在返回的候选列表中

---

### Story 1.18: 黑名单页面（前端）

As a 用户,
I want 查看并管理我的黑名单,
So that 我能解除误拉黑的餐厅。

**Acceptance Criteria:**

**Given** 进入黑名单页面（`/restaurants/blacklist`）
**When** 有已拉黑的餐厅
**Then** 展示黑名单列表，每项显示餐厅名 + 拉黑时间 + 「解除拉黑」按钮

**Given** 点击「解除拉黑」
**When** API 调用成功
**Then** 该餐厅从黑名单移除，可再次出现在候选列表，toast 提示"已解除拉黑"

**Epic 1 总 Stories：18 个，覆盖 FR-00, FR-05~09, ARCH-01~08 ✅**


---

## Epic 2: 转盘决策流程

用户能通过转盘模式完成完整的单人决策流程并查看、确认结果。

### Story 2.1: 候选列表 API（含权重算法）

As a 用户,
I want 系统返回加权后的候选餐厅列表,
So that 转盘/扫雷能按正确权重分配扇区和格子。

**Acceptance Criteria:**

**Given** 用户有3家餐厅（1家收藏，1家拉黑，1家普通）
**When** `GET /api/candidates` with `X-User-Id:1`
**Then** 返回2条候选（排除拉黑），收藏餐厅 weight=2，普通餐厅 weight=1
**And** 响应体包含 `{candidates:[{id,name,category,tags,isFavorite,weight}], total}`

**Given** 传入 `?limit=16`，实际候选餐厅（以餐厅为单位）超过16家
**When** 调用候选 API
**Then** 按加权随机抽样：先保留所有收藏餐厅，再从普通餐厅中随机抽取补足至16家上限
**And** 响应中 `sampledDown:true` 标记此次做了截断抽样

**Given** 收藏餐厅数量本身已超过16家（如20家收藏，0家普通）
**When** 调用候选 API with `?limit=16`
**Then** 从收藏餐厅中随机截断至16家，不再补普通餐厅
**And** 响应中 `sampledDown:true`，所有16条记录 weight=2

**Given** 所有餐厅都被拉黑
**When** 调用候选 API
**Then** 返回空数组，total=0

---

### Story 2.2: 每日配置 API（daily_config，含跨日重置）

As a 用户,
I want 系统记录今日的重玩次数,
So that 达到上限后无法继续换一个。

**Acceptance Criteria:**

**Given** 今天是第一次发起决策
**When** `GET /api/daily-config`
**Then** 使用 `INSERT ... ON DUPLICATE KEY UPDATE` 或等价 UPSERT 操作创建当日记录（date=今天，replay_count=0），返回该记录
**And** 并发两次同天首次请求时，数据库只产生一条 daily_config 记录（唯一约束 user_id+date 保证）

**Given** daily_config.date 不等于今天（跨日）
**When** `GET /api/daily-config`
**Then** 使用 UPSERT 创建新的当日记录（replay_count 归零），返回新记录

**Given** 当日 replay_count=2，maxReplayCount 设置为3
**When** `PATCH /api/daily-config` with `{incrementReplay:true}`
**Then** replay_count 变为3，返回更新后记录

**Given** 当日 replay_count 已达 maxReplayCount
**When** `PATCH /api/daily-config` with `{incrementReplay:true}`
**Then** 返回 400，`{code:40001, message:"今日重玩次数已达上限"}`

**Given** 调用 `PATCH /api/daily-config` with `{mood:"😴"}`
**When** API 处理
**Then** 更新当日 daily_config.mood 字段，返回 200 含更新后记录
**And** 合法 mood 值枚举：`"😊"` / `"😐"` / `"😴"` / `"😤"` / `null`（null 表示清除心情）

**Given** 调用 `PATCH /api/daily-config` with `{mood:"😎"}`（非枚举值）
**When** API 处理
**Then** 返回 400，`{code:40001, message:"mood 必须为 😊/😐/😴/😤 之一或 null"}`

---

### Story 2.3: 首页决策入口（FR-01）

As a 用户,
I want 在首页看到醒目的「开始决策」按钮,
So that 打开页面就能直接发起决策。

**Acceptance Criteria:**

**Given** 用户有 ≥ 2 家有效餐厅
**When** 打开首页
**Then** 页面中央或顶部显示醒目的「开始决策」按钮，可点击

**Given** 点击「开始决策」
**When** 按钮被触发
**Then** 跳转至模式选择页，跳转时间 < 300ms

**Given** 首页右上角
**When** 页面加载
**Then** 显示心情 icon（预留位置，Epic 5 实现功能，此处仅占位）

---

### Story 2.4: 模式选择页（FR-02）

As a 用户,
I want 选择转盘或扫雷模式后进入对应决策界面,
So that 我能用自己喜欢的方式做决策。

**Acceptance Criteria:**

**Given** 进入模式选择页
**When** 页面加载
**Then** 展示两张大卡片：「转盘模式」（含图标和说明）+ 「扫雷模式」（置灰，标注"即将上线"）
**And** 底部显示「邀请朋友一起选」入口（置灰，Epic 6 实现）

**Given** 点击「转盘模式」卡片
**When** 用户确认选择
**Then** 跳转至转盘决策页 `/decide/wheel`

---

### Story 2.5: 转盘候选数据构建（权重算法 + 候选 >16 勾选逻辑）

As a 用户,
I want 转盘按餐厅权重正确分配扇区,
So that 收藏餐厅出现概率是普通餐厅的2倍。

**Acceptance Criteria:**

**Given** 候选列表含1家收藏+2家普通（共3家）
**When** 构建转盘数据
**Then** 候选数组长度为4（收藏出现2次，普通各1次），单元测试断言此结构

**Given** 过滤后候选餐厅 ≤ 16（含收藏2倍份额）
**When** 进入转盘页
**Then** 直接渲染转盘，不显示勾选界面

**Given** 过滤后候选餐厅（以餐厅为单位）> 16
**When** 进入转盘页
**Then** 展示勾选界面，以餐厅为单位列出（不展开2倍份额），默认全选
**And** 底部显示「确认（N 家参与）」按钮，N 实时更新
**And** 勾选数 < 2 时按钮置灰，提示"至少选2家"

---

### Story 2.6: 转盘 Canvas 渲染

As a 用户,
I want 看到一个视觉清晰的转盘,
So that 能直观看到各餐厅在转盘上的分配。

**Acceptance Criteria:**

**Given** 转盘有4个候选（1家收藏×2 + 2家普通×1）
**When** Canvas 渲染
**Then** 收藏餐厅占 2/4（180°），每家普通餐厅占 1/4（90°），颜色区分不同扇区
**And** 每个扇区显示对应餐厅名称（文字居中，超长截断）
**And** 顶部有固定指针指向当前扇区

**Given** 转盘渲染完成
**When** 用户查看
**Then** 转盘直径适配不同屏幕宽度（最小375px下不溢出）

---

### Story 2.7: 转盘旋转动画与结果逻辑

As a 用户,
I want 点击「开始」后转盘旋转并给出结果,
So that 决策过程有趣且结果随机公平。

**Acceptance Criteria:**

**Given** 转盘页已加载
**When** 点击「开始」按钮
**Then** 转盘以随机角速度旋转，动画时长 2~4 秒，有缓出效果
**And** 旋转过程中「开始」按钮置灰，不可重复点击

**Given** 旋转结束
**When** 动画停止
**Then** 指针指向的扇区高亮显示（边框加粗或颜色变化）
**And** 0.5秒后自动跳转至结果页，携带选中餐厅 id

**Given** 候选池为 1家收藏餐厅 + 1家普通餐厅（权重比 2:1，收藏期望频率 66.7%），连续运行1000次转盘（自动化测试）
**When** 统计结果
**Then** 收藏餐厅出现频率在 60%~73% 之间（期望66.7%，允许±6.7%误差，3σ范围）
**And** 普通餐厅出现频率在 27%~40% 之间

---

### Story 2.8: 结果页 — 单人转盘模式（FR-15）

As a 用户,
I want 看到清晰的决策结果页并确认选择,
So that 我知道今天吃什么，并将记录保存。

**Acceptance Criteria:**

**Given** 转盘选出"海底捞"
**When** 跳转至结果页
**Then** 大字显示"海底捞"，次要展示品类"火锅"和备注（若有）

**Given** 点击「就这家了！」
**When** API 调用成功（`POST /api/history`）
**Then** 写入 decision_history 记录（mode='wheel'），toast "已记录，今天就吃这家！"，跳转首页

**Given** 当日剩余重玩次数 > 0
**When** 点击「换一个」
**Then** 调用 `PATCH /api/daily-config {incrementReplay:true}`，扣减次数，返回转盘页重新旋转
**And** 按钮旁显示"还可以换 N 次"

**Given** 当日重玩次数已达上限
**When** 结果页加载
**Then** 「换一个」按钮置灰，提示"今天的纠结次数已用完，就它了！"

**Given** 单人模式
**When** 结果页显示
**Then** 不显示任何多人等待相关 UI

---

### Story 2.9: 决策历史记录 API（基础版）

As a 用户,
I want 系统在我确认决策后自动记录,
So that 历史数据可供后续过滤使用。

**Acceptance Criteria:**

**Given** 合法请求体 `{restaurantId:1, mode:"wheel"}` 携带 `X-User-Id: 1`
**When** `POST /api/history`
**Then** 在 decision_history 插入记录（decided_at=当前时间，user_id 取自 X-User-Id header），返回 201 含记录完整信息
**And** 响应体中 `userId` 字段等于请求头 `X-User-Id` 的值（确保历史记录归属正确）

**Given** restaurantId 不存在
**When** `POST /api/history`
**Then** 返回 404，`{code:40401, message:"餐厅不存在"}`

**Given** mode 不是 'wheel' 或 'minesweeper'
**When** `POST /api/history`
**Then** 返回 400，`{code:40001, message:"mode 必须为 wheel 或 minesweeper"}`

**Epic 2 总 Stories：9 个，覆盖 FR-01, FR-02, FR-03, FR-15（转盘）✅**


---

## Epic 3: 扫雷决策流程

用户能通过扫雷游戏化模式选出今天吃什么。

### Story 3.1: 扫雷格子数据构建（权重算法）

As a 用户,
I want 扫雷格子按收藏权重正确分配,
So that 收藏餐厅被选中的概率是普通餐厅的2倍。

**Acceptance Criteria:**

**Given** 候选列表含1家收藏+2家普通
**When** 构建扫雷格子数组
**Then** 格子总数为4（收藏2格 + 普通各1格），单元测试断言格子数组结构正确
**And** 每个格子映射到对应餐厅 id

**Given** 收藏餐厅格子（每家×2）+ 普通餐厅格子（每家×1）合计超过12（如5家收藏10格 + 5家普通5格 = 15格）
**When** 构建格子数组
**Then** 优先保留所有收藏餐厅格子（每家2格），从普通餐厅格子中随机剔除至总数 ≤ 12
**And** 单元测试断言最终格子数 ≤ 12，且所有收藏餐厅各有2格

**Given** 收藏餐厅格子本身已超过12（如7家收藏 × 2 = 14格）
**When** 构建格子数组
**Then** 从收藏餐厅中随机截断至6家（12格），不放入普通餐厅
**And** 单元测试断言不超过12格

**Given** 只有1家候选
**When** 进入扫雷页
**Then** 显示提示"候选餐厅不足，请先添加更多餐厅"，不渲染格子

---

### Story 3.2: 扫雷格子布局与翻牌动画（前端）

As a 用户,
I want 看到整齐的格子矩阵并通过点击翻牌,
So that 决策有趣且有紧张感。

**Acceptance Criteria:**

**Given** 进入扫雷决策页
**When** 页面加载
**Then** 展示 N 个格子（N≤12）网格布局，格子背面统一样式，看不出内容

**Given** 用户点击任意一个格子
**When** 触发翻牌
**Then** 该格子执行 CSS 3D 翻转动画（300~500ms），翻开后显示餐厅名称
**And** 这是第一次点击，翻开即为最终结果，其余格子变为不可点击

**Given** 翻牌动画完成
**When** 结果揭晓
**Then** 0.5秒后跳转结果页，携带选中餐厅 id

**Given** 扫雷格子组件初始化
**When** 接收 `mode` 参数（`'solo'` | `'multi'`，默认 `'solo'`）
**Then** `solo` 模式：点击后客户端直接决定结果，跳转结果页，无需 WebSocket 事件
**And** `multi` 模式：点击后发送 WS `{event:"cell_clicked", data:{cellIndex}}`，等待服务端 `result_revealed` 广播后再翻牌揭晓（Story 6.10 实现）
**And** 两种模式共用相同的翻牌动画组件，仅结果确认逻辑通过 `mode` 参数区分

---

### Story 3.3: 结果页 — 扫雷模式适配（FR-15 补充）

As a 用户,
I want 扫雷模式的结果页与转盘一致,
So that 无论哪种模式都有相同的确认体验。

**Acceptance Criteria:**

**Given** 扫雷选出"麦当劳"
**When** 跳转结果页
**Then** 大字显示"麦当劳"，展示品类/备注，显示"决策方式：扫雷"

**Given** 点击「换一个」
**When** 扣减次数成功
**Then** 返回扫雷页，所有格子重置为背面朝上，可重新点击

**Given** 重玩次数达上限
**When** 结果页加载
**Then** 「换一个」置灰，提示文案与转盘模式一致

---

### Story 3.4: 模式选择页激活扫雷入口

As a 用户,
I want 模式选择页正式显示扫雷模式入口,
So that 我可以在转盘和扫雷之间自由选择。

**Acceptance Criteria:**

**Given** 进入模式选择页（Story 3.1~3.3 已实现，`/decide/minesweeper` 路由已可用）
**When** 页面加载
**Then** 「扫雷模式」卡片处于可点击状态，不显示"即将上线"标注
**And** 与「转盘模式」卡片视觉权重相同

**Given** 用户点击「扫雷模式」卡片
**When** 点击事件触发
**Then** 跳转至扫雷决策页 `/decide/minesweeper`，跳转时间 < 300ms

**Epic 3 总 Stories：4 个，覆盖 FR-04, FR-15（扫雷）✅**


---

## Epic 4: 个性化设置

用户能自定义工具的行为参数。

### Story 4.1: 设置 API（FR-14）

As a 用户,
I want 通过 API 读写个人偏好设置,
So that 自定义参数在重启后仍然生效。

**Acceptance Criteria:**

**Given** 首次调用 `GET /api/settings`
**When** 用户无任何设置记录
**Then** 返回 FR-14 定义的两项设置默认值：`{maxReplayCount:3, historyExcludeDays:3}`
**And** 响应结构为 `{code:0, data:{maxReplayCount:3, historyExcludeDays:3}}`

**Given** 调用 `PUT /api/settings/maxReplayCount` with `{value:5}`（数值类型）
**When** API 处理
**Then** 更新 settings 表对应记录，返回 `{code:0, data:{key:"maxReplayCount", value:5}}`（响应中也为数值类型）

**Given** 调用 `PUT /api/settings/maxReplayCount` with `{value:"5"}`（字符串类型）
**When** API 处理
**Then** 返回 400，`{code:40001, message:"value 必须为数值类型"}`

**Given** 使用不合法的 key（如 `PUT /api/settings/unknownKey`）
**When** API 处理
**Then** 返回 400，`{code:40001, message:"不支持的设置项"}`

---

### Story 4.2: 设置页（前端）

As a 用户,
I want 在设置页面修改偏好参数,
So that 不需要手动调用 API。

**Acceptance Criteria:**

**Given** 进入设置页 `/settings`
**When** 页面加载
**Then** 展示以下可配置项（含当前值）：每日重玩次数上限（数字输入/滑块）、历史排除天数（数字输入/滑块）

**Given** 修改"每日重玩次数"为5并保存
**When** API 调用成功
**Then** toast 提示"设置已保存"，下次决策时生效

**Epic 4 总 Stories：2 个，覆盖 FR-14 ✅**


---

## Epic 5: 历史沉淀与智能过滤

用户能查看决策历史、排除近期餐厅、按心情/口味过滤候选池。

### 过滤组合顺序规范（候选 API 实现约束）

候选 API `GET /api/candidates` 支持三层过滤，**执行顺序固定如下**：

```
原始候选池（排除拉黑）
  → ① 历史排除（excludeHistory）
  → ② 心情过滤（mood）
  → ③ 口味过滤（flavorTags）
  → 最终候选列表
```

**降级优先级规则：**
- 每层过滤后若候选数 < 2，该层**立即降级**（跳过此层，使用上一层结果），并在响应中标记对应降级标志
- 降级不影响后续层的过滤执行：历史排除降级后，心情过滤仍正常应用于全量候选
- 响应结构包含：`{candidates, total, sampledDown, historyExcludeDowngraded, moodFilterDowngraded, flavorFilterDowngraded}`
- 前端根据响应标志展示对应的降级提示（各层提示文案独立，可叠加显示）

### Story 5.1: 历史记录列表 API + 页面（FR-10）

> **合并原因：** 历史 API（GET /api/history）和历史页面逻辑高度耦合且均较简单，合并为单 Story 减少上下文切换成本。若实际开发时 API 和前端由不同人负责，可拆分为 5.1a/5.1b。

As a 用户,
I want 查看我的历史决策记录,
So that 了解自己的点餐规律。

**Acceptance Criteria:**

**Given** `GET /api/history`
**When** 用户有决策记录
**Then** 返回最近30条，按 decided_at 倒序，每条包含：餐厅名称、决策模式、决策时间

**Given** 进入历史记录页 `/history`
**When** 页面加载
**Then** 列表展示每条记录：餐厅名 + 决策模式图标 + 相对时间（如"2小时前"）

**Given** 历史记录为空
**When** 进入页面
**Then** 显示空状态"还没有决策记录，快去试试吧！"

---

### Story 5.2: 历史排除逻辑集成（FR-11）

As a 用户,
I want 决策时自动排除最近吃过的餐厅,
So that 不会反复推荐同一家。

**Acceptance Criteria:**

**Given** 候选 API 传入 `?excludeHistory=true`（默认为 true）
**When** 处理请求
**Then** 从候选列表中排除 historyExcludeDays（默认3天）内出现在 decision_history 的餐厅

**Given** 历史排除后候选数 < 2
**When** candidates API 处理
**Then** 自动降级为不排除历史，返回全量候选
**And** 响应中 `historyExcludeDowngraded:true`，前端显示提示"最近常去的餐厅已全部包含"

**Given** 决策前置页（模式选择页）
**When** 页面加载
**Then** 显示"排除最近N天已吃过"开关，默认开启，用户可关闭

**Given** 同时传入 `?excludeHistory=true&mood=😴&flavorTags=清淡`
**When** 候选 API 处理
**Then** 按顺序执行：历史排除 → 心情过滤 → 口味过滤，每层不足2家时独立降级
**And** 响应中各降级标志独立设置，前端可据此显示多条降级提示

---

### Story 5.3: 心情过滤后端逻辑（FR-12）

As a 用户,
I want 选择心情后候选餐厅按规则过滤或排序,
So that 推荐结果符合我当前的心理状态。

**Acceptance Criteria:**

**Given** daily_config.mood = '😴'（困倦）
**When** `GET /api/candidates`
**Then** 只返回 tags 包含"清淡"的餐厅；若结果 < 2 则返回全量并设置 `moodFilterDowngraded:true`

**Given** daily_config.mood = '😤'（烦躁）
**When** `GET /api/candidates`
**Then** 只返回 tags 包含"重口"的餐厅；不足2则降级为全量

**Given** daily_config.mood = '😐'（一般）
**When** `GET /api/candidates`
**Then** 候选集不缩小（全量返回），按最近7天内有 decision_history 记录的 decided_at DESC 排序靠前；无历史记录的餐厅排在有历史记录之后，顺序随机
**And** 可测试场景：候选餐厅A最近7天有历史记录，候选餐厅B无历史，则A排在B前面

**Given** daily_config.mood = '😊' 或 null
**When** `GET /api/candidates`
**Then** 不干预，返回正常候选集

---

### Story 5.4: 心情选择器前端（FR-12）

As a 用户,
I want 在首页右上角选择今天的心情,
So that 候选餐厅能匹配我的状态。

**Acceptance Criteria:**

**Given** 首页右上角心情 icon
**When** 点击
**Then** 展开表情面板（😊 😐 😴 😤），可选择

**Given** 选择 😴
**When** API 调用 `PATCH /api/daily-config {mood:"😴"}` 成功
**Then** 心情 icon 更新为 😴，有已选中的视觉标记（如彩色背景）
**And** 候选列表在下次决策时按过滤规则应用

**Given** 跨日（服务器本地日期变更）
**When** 用户打开首页
**Then** 心情 icon 恢复为未选中状态（daily_config 跨日重置）

**Given** 心情过滤触发降级
**When** 候选页加载
**Then** 显示提示"当前心情没有足够匹配的餐厅，已显示全部候选"

---

### Story 5.5: 口味偏好过滤后端逻辑（FR-13）

As a 用户,
I want 选择口味偏好后候选餐厅按标签过滤,
So that 决策结果更符合今天的口味需求。

**Acceptance Criteria:**

**Given** 候选 API 传入 `?flavorTags=辣`
**When** 处理请求
**Then** 只返回 tags 包含"辣"的餐厅

**Given** 过滤后候选 < 2
**When** candidates API 处理
**Then** 降级为返回全量，响应中 `flavorFilterDowngraded:true`，前端提示"没有足够匹配「辣」的餐厅，已显示全部候选"

**Given** flavorTags = '随意' 或未传
**When** 处理请求
**Then** 不过滤，返回全量候选

---

### Story 5.6: 口味偏好前端（FR-13）

As a 用户,
I want 在模式选择页选择今天的口味偏好,
So that 转盘/扫雷候选池自动过滤。

**Acceptance Criteria:**

**Given** 进入模式选择页
**When** 页面加载
**Then** 展示口味标签行：重口 / 清淡 / 咸 / 甜 / 随意（chips 单选）

**Given** 选择"清淡"
**When** 点击「进入决策」
**Then** 候选 API 请求自动附带 `?flavorTags=清淡`

**Given** 口味过滤降级发生
**When** 进入决策页
**Then** 顶部显示 toast 提示降级原因

**Epic 5 总 Stories：6 个，覆盖 FR-10, FR-11, FR-12, FR-13 ✅**


---

## Epic 6: 多人实时协作决策

用户能邀请朋友通过分享链接加入会话，实时一起做决策。

### Story 6.1: WebSocket 服务器骨架

As a 开发者,
I want 一个稳定的 WebSocket 服务器基础,
So that 多人会话能通过 ws 连接实时通信。

**Acceptance Criteria:**

**Given** 服务启动后客户端连接 `ws://localhost:3000/ws/sessions/:token?nickname=Alice`
**When** 连接建立
**Then** 服务端在内存 Map 中记录该连接（sessionToken → [ws1, ws2...]）
**And** 向客户端发送 `{event:"session_state", data:{...}}` 初始状态

**Given** 客户端断开连接
**When** ws close 事件触发
**Then** 从内存 Map 中移除该连接，不影响同会话其他连接

**Given** 发送格式错误的 JSON 消息
**When** 服务端接收
**Then** 忽略该消息，记录 console.warn，不抛出异常

**Given** 客户端携带不存在的 token 连接 `ws://host/ws/sessions/invalid_token`
**When** 服务端尝试查找会话
**Then** 服务端发送 `{event:"error", data:{code:40401, message:"会话不存在或已过期"}}` 后关闭连接（WS 关闭码 4404）

**Given** 客户端携带已过期的 token 连接
**When** 服务端查找会话，发现 status='expired'
**Then** 发送 `{event:"error", data:{code:41001, message:"会话已过期"}}` 后关闭连接（WS 关闭码 4410）

---

### Story 6.2: 创建会话 API + 候选快照（FR-16）

As a 发起人,
I want 创建一个多人决策会话并获得分享链接,
So that 可以邀请朋友加入一起决策。

**Acceptance Criteria:**

**Given** 发起人有 ≥ 2 家候选餐厅
**When** `POST /api/sessions {mode:"wheel"}`
**Then** 返回 201，含 `{shareToken, expiresAt, sessionId}`
**And** 将**展开后的权重数组**存入 `decision_sessions.candidate_snapshot`：收藏餐厅出现2次，普通餐厅出现1次，格式为 `[{id, name, category}, {id, name, category}, ...]`（收藏餐厅的两条记录相邻排列）
**And** 快照数组的下标与 Story 6.9 的 `resultIndex` 直接对应，客户端无需再次展开
**And** 在 `session_participants` 表插入发起人记录（role='host'，关联 user_id=1）

**Given** 会话创建后调用 `GET /api/sessions/:token/state`
**When** 查询参与者列表
**Then** 发起人已在列表中（role='host'），无需单独调用 join 接口

**Given** 会话创建24小时后
**When** 有人尝试加入或使用
**Then** 返回 410，`{code:41001, message:"会话已过期"}`

---

### Story 6.3: 分享链接生成与复制（前端）

As a 发起人,
I want 一键生成并复制分享链接,
So that 方便通过微信/其他渠道发给朋友。

**Acceptance Criteria:**

**Given** 模式选择页底部「邀请朋友一起选」入口
**When** 点击（Epic 6 实现后激活）
**Then** 弹出多人模式选择卡片，选择转盘或扫雷后调用创建会话 API

**Given** 会话创建成功
**When** 获得 shareToken
**Then** 显示链接 `{BASE_URL}/session/{shareToken}/lobby`，其中 BASE_URL 取自 `.env` 中的 `APP_BASE_URL` 配置项（默认 `http://localhost:3000`，生产部署时应替换为实际域名）
**And** 提供「一键复制」按钮，点击后 toast 提示"链接已复制"
**And** 链接文字可点击，点击后在新标签页打开（用于发起人自测）

---

### Story 6.4: 加入会话 API + 临时用户创建（FR-17）

As a 受邀者,
I want 通过分享链接输入昵称后加入会话,
So that 无需注册即可参与决策。

**Acceptance Criteria:**

**Given** 合法的 shareToken 和昵称"Bob"
**When** `POST /api/sessions/:token/join {nickname:"Bob"}`
**Then** 在 users 表创建临时用户记录（name='Bob'），在 session_participants 插入参与记录，返回 `{userId, sessionId}`

**Given** 昵称为空
**When** 调用 join API
**Then** 返回 400，`{code:40001, message:"昵称不能为空"}`

**Given** 昵称超过20字
**When** 调用 join API
**Then** 返回 400，`{code:40001, message:"昵称最长20字"}`

**Given** 会话已过期（status='expired'）
**When** 调用 join API
**Then** 返回 410，`{code:41001, message:"会话已过期"}`

---

### Story 6.5: 受邀者昵称输入页（前端）

As a 受邀者,
I want 通过分享链接进入页面后输入昵称加入会话,
So that 能以我的名字参与决策。

**Acceptance Criteria:**

**Given** 访问 `/session/:token/lobby`（未加入状态）
**When** 页面加载
**Then** 显示昵称输入框 + 「加入」按钮，展示会话基本信息（发起人名称）

**Given** 会话已过期
**When** 访问链接
**Then** 显示"会话已结束"页面，不显示输入框

**Given** 成功加入
**When** API 返回成功
**Then** 将 `{userId, sessionId, token}` 存入 `sessionStorage`，进入等待室视图，显示已加入的参与者列表

**Given** 受邀者关闭标签页后重新访问相同的 `/session/:token/lobby`
**When** 页面加载，检测到 `sessionStorage` 中已有该 token 对应的 `userId`
**Then** 跳过昵称输入，直接以已有身份重连 WebSocket 进入等待室，不重新创建用户记录

---

### Story 6.6: 等待室实时参与者列表（FR-18）

As a 发起人,
I want 实时看到已加入的参与者列表,
So that 确认人员到齐后再开始决策。

**Acceptance Criteria:**

**Given** 发起人在等待室
**When** 受邀者加入
**Then** 发起人界面实时更新参与者列表（延迟 < 1秒），无需刷新页面
**And** 新成员加入有入场动效

**Given** 等待室有参与者列表
**When** 发起人查看
**Then** 列出所有参与者昵称（含发起人，标注"发起人"）

**Given** 发起人点击「开始决策」
**When** 参与者 ≥ 1（含发起人共≥2人）
**Then** 按钮可点击，触发后广播 deciding_started 事件

---

### Story 6.7: WebSocket 等待室事件（participant_joined / session_state）

As a 开发者,
I want 等待室的 WebSocket 事件能正确广播,
So that 所有参与者实时同步会话状态。

**Acceptance Criteria:**

**Given** 新用户成功加入会话
**When** `POST /api/sessions/:token/join` 成功
**Then** 服务端向该会话所有已连接的 ws 客户端广播 `{event:"participant_joined", data:{nickname, totalCount}}`

**Given** 客户端连接建立时
**When** ws 握手完成
**Then** 服务端发送 `{event:"session_state", data:{status, participants:[{nickname}], candidateSnapshot}}`

---

### Story 6.8: 开始决策广播（deciding_started）

As a 发起人,
I want 点击「开始决策」后所有参与者同步进入决策界面,
So that 多人可以同步参与转盘/扫雷。

**Acceptance Criteria:**

**Given** 发起人点击「开始决策」
**When** `POST /api/sessions/:token/start`
**Then** 会话状态变为 deciding，向所有连接广播 `{event:"deciding_started", data:{status:"deciding", candidateSnapshot:[...]}}`

**Given** 参与者收到 deciding_started 事件
**When** 客户端处理
**Then** 自动跳转至多人决策界面（`/session/:token/decide`），加载候选快照数据

---

### Story 6.9: 多人转盘 — 随机投票机制（FR-19）

> ⚠️ 本 Story 已于 2026-03-30 替换原「同步控制」方案。原方案仅发起人可触发，参与者体验被动；新方案改为每人独立转盘投票，结果取最高票，真正实现多人参与决策。

As a 多人会话参与者,
I want 各自独立转动转盘并投票，票数最多的餐厅胜出,
So that 每个人都真正参与了决策，而不只是旁观。

**Acceptance Criteria:**

**Given** 会话参与人数不足2人（仅发起人自己）
**When** 发起人尝试进入多人模式
**Then** 提示「至少需要2人参与多人模式」，不允许进入多人决策流程

**Given** 所有参与者进入多人决策界面
**When** 界面加载
**Then** 所有人均显示可点击的「转！」按钮，顶部显示 30s 倒计时，显示「0/N 人已转」进度

**Given** 参与者点击「转！」
**When** 客户端触发
**Then** 该参与者的转盘开始旋转动画（2~4秒），转盘停止后客户端随机从 candidateSnapshot 取一个结果，向服务端发送 `{event:"spin_submitted", data:{resultRestaurantId, resultRestaurantName, resultIndex}}`
**And** 该参与者按钮变为「已投票 ✓」置灰，不可重复提交
**And** 所有人界面更新进度为「X/N 人已转」

**Given** 所有参与者均已提交 OR 30s 倒计时结束
**When** 服务端触发统计
**Then** 若已有至少1个有效结果，服务端统计各餐厅得票数，取最高票餐厅
**And** 向所有客户端广播 `{event:"round_result", data:{winner:{restaurantId, restaurantName, votes}, allVotes:[{restaurantId, restaurantName, votes}], isTie:false}}`
**And** 若倒计时结束时仍有人未转，未转者视为弃权，不影响已有结果

**Given** 服务端统计后出现平局（多家餐厅票数相同）
**When** 广播 round_result
**Then** `isTie: true`，`candidates` 仅包含平局的餐厅列表
**And** 向所有客户端广播 `{event:"tie_break_start", data:{candidates:[...], round:2}}`
**And** 所有人进入第二轮投票，仅平局餐厅参与候选，重新开始 30s 倒计时
**And** 若第二轮仍平局，继续重复直至分出胜负（最多3轮后随机选一个）

**Given** 服务端统计后所有人均弃权（无人在 30s 内转盘）
**When** 超时触发
**Then** 向所有客户端广播 `{event:"no_result", data:{message:"没有有效结果"}}`
**And** 前端提示「没有人转盘，请重试」，显示「重新开始」按钮

**Given** 客户端收到 round_result（isTie: false）
**When** 渲染结果页
**Then** 大字显示胜出餐厅名称，展示「获得 N 票」，下方显示每位参与者的投票明细（谁转出了什么）

---

### Story 6.10: 多人扫雷 — 先到先得（FR-19）

As a 多人会话参与者,
I want 任意人都能点击格子，第一个点击者决定结果,
So that 扫雷有公平的竞争感。

**Acceptance Criteria:**

**Given** 所有参与者在多人扫雷界面
**When** 页面加载
**Then** 所有参与者的格子均可点击（广播结果前）

**Given** 参与者A点击第3格，参与者B同时点击第7格
**When** 服务端接收到两个 cell_clicked 事件
**Then** 服务端只处理先到达的点击，锁定结果，忽略后续点击
**And** 向所有客户端广播 `{event:"result_revealed", data:{resultRestaurantId, clickedBy:"A"}}`

**Given** 参与者B点击格子后、收到 result_revealed 广播前（竞态窗口期）
**When** 客户端本地处理点击事件
**Then** B的格子立即显示"点击中..."加载状态（乐观更新），不跳转不显示结果
**And** 收到 result_revealed 后：若 clickedBy=B 则正常翻牌揭晓；若 clickedBy≠B 则格子回滚为背面状态，并广播翻开的是哪格

**Given** 服务端已锁定结果（session 状态 = 'deciding_locked'）
**When** 任意客户端发送 cell_clicked
**Then** 服务端忽略该消息，不发送任何响应

---

### Story 6.11: 多人结果页与会话确认（FR-19, FR-15）

As a 发起人,
I want 在多人结果页确认最终结果，其他人等待,
So that 决策权在发起人手中。

**Acceptance Criteria:**

**Given** 结果揭晓后
**When** 所有参与者跳转至结果页
**Then** 发起人看到「就这家了！」和「换一个」按钮
**And** 其他参与者看到"等待发起人确认..."的等待状态

**Given** 发起人点击「就这家了！」
**When** `POST /api/sessions/:token/confirm`
**Then** 在单个数据库事务中写入所有参与者（含发起人）的 decision_history 记录（mode='wheel'或'minesweeper'，decided_at=当前时间）
**And** 会话 status 变为 done
**And** 广播 `{event:"session_done", data:{resultRestaurantId, resultRestaurantName}}`
**And** 所有参与者自动跳转至会话结束页

**Given** decision_history 批量写入事务失败（如数据库异常）
**When** confirm API 处理
**Then** 事务回滚，返回 500，会话状态不变为 done，前端提示"确认失败，请重试"

**Given** 发起人点击「换一个」
**When** `POST /api/sessions/:token/replay`
**Then** 服务端使用**发起人（host）的 daily_config** 记录扣减 replay_count（临时受邀用户无重玩限制概念，不使用其 daily_config）
**And** 服务端广播 `{event:"replay_initiated", data:{remainingReplays}}`
**And** 所有参与者自动返回多人决策界面：扫雷模式重置全部格子为背面朝上，转盘模式重置为初始静止状态
**And** 若 replay_count 已达上限，返回 400，不广播，发起人侧「换一个」置灰

---

### Story 6.12: WebSocket 断线重连（NFR-05）

As a 用户,
I want 断网后自动重连并恢复会话状态,
So that 网络波动不影响多人决策体验。

**Acceptance Criteria:**

**Given** 客户端 WebSocket 连接断开
**When** 检测到断线
**Then** 客户端自动尝试重连，重连间隔采用指数退避（1s, 2s, 4s...），最大间隔5秒

**Given** 重连成功
**When** 新连接建立
**Then** 服务端重新发送 `{event:"session_state"}`，客户端恢复至最新会话状态

**Given** 重连过程中
**When** 前端界面
**Then** 显示"重连中..."提示，不阻塞其他 UI 操作

**Epic 6 总 Stories：12 个，覆盖 FR-16, FR-17, FR-18, FR-19 ✅**


---

## Epic 7: 上线就绪与质量打磨

产品达到可上线的质量标准。

### Story 7.1: 首屏性能优化（NFR-01/02）

As a 用户,
I want 页面加载迅速,
So that 不需要等待就能快速开始决策。

**Acceptance Criteria:**

**Given** 本地网络环境
**When** 首次加载首页（无缓存）
**Then** 首屏内容可见时间（FCP）< 2秒
**And** 后端 API 响应时间 P95 < 200ms（通过 ab/wrk 压测验证）

**Given** 静态资源
**When** 检查响应头
**Then** CSS/JS/图片文件设置合适的 Cache-Control 头

---

### Story 7.2: 移动端响应式适配（NFR-09）

As a 用户,
I want 在手机上正常使用工具,
So that 不限于桌面环境。

**Acceptance Criteria:**

**Given** 使用 375px 宽度的设备（iPhone SE 模拟）
**When** 打开各主要页面（首页/转盘/扫雷/结果页/餐厅管理）
**Then** 所有页面无横向滚动条，文字不溢出，按钮可点击区域 ≥ 44×44px

**Given** 转盘页在375px宽度
**When** Canvas 渲染
**Then** 转盘直径适配屏幕宽度，文字不溢出扇区

---

### Story 7.3: 全局错误边界处理

As a 用户,
I want 遇到错误时看到友好提示而非白屏,
So that 不会因为偶发错误无法继续使用。

**Acceptance Criteria:**

**Given** API 请求超时或网络断开
**When** 前端发起请求
**Then** 展示友好错误 toast "网络连接异常，请检查后重试"，不显示技术错误信息

**Given** 前端 JavaScript 运行时错误
**When** 发生未捕获异常
**Then** 全局错误处理器捕获，展示"出了一点小问题，请刷新重试"，并记录到 console.error

**Given** 后端返回 500 错误
**When** 前端接收响应
**Then** 展示"服务异常，请稍后重试"，不崩溃

---

### Story 7.4: 跨浏览器兼容验证（NFR-08）

As a 用户,
I want 在主流浏览器上正常使用,
So that 不受浏览器限制。

**Acceptance Criteria:**

**Given** 在 Chrome 最新版
**When** 完整执行：添加餐厅 → 转盘决策 → 查看结果
**Then** 全程无控制台错误，功能正常

**Given** 在 Safari 最新版（macOS）
**When** 执行相同流程
**Then** CSS 动画、Canvas 转盘、WebSocket 均正常工作

**Given** 在 Firefox 最新版
**When** 执行相同流程
**Then** 核心功能正常

---

### Story 7.5: WebSocket 并发压测（NFR-03/04）

As a 开发者,
I want 验证10人并发会话的稳定性,
So that 多人功能在实际使用中不崩溃。

**Acceptance Criteria:**

**Given** 模拟10个 WebSocket 客户端同时连接同一会话
**When** 运行1分钟
**Then** 无连接断开，内存无显著泄漏（< 50MB 增长）
**And** 消息广播延迟 < 500ms（局域网）

---

### Story 7.6: 上线 Checklist 与部署文档

As a 开发者,
I want 完整的部署指南和上线核查清单,
So that 任何人都能按文档独立部署。

**Acceptance Criteria:**

**Given** README.md（或 docs/DEPLOY.md）
**When** 开发者按文档操作
**Then** 文档包含：环境要求（Node.js 版本、MySQL 版本）、安装步骤（clone/npm install/.env配置/数据库初始化/启动）、Nginx 反向代理配置示例

**Given** 上线前核查清单
**When** 执行检查
**Then** 包含：.env 不提交到 git（.gitignore 验证）、migrations 脚本可重复执行验证、所有 API 异常路径有测试覆盖

---

### Story 7.7: 首次使用数据库配置向导（NFR-06）

As a 首次部署用户,
I want 启动服务时能通过清晰的提示完成数据库配置,
So that 不需要阅读文档就能在1分钟内完成初始化。

**Acceptance Criteria:**

**Given** 启动服务时检测到 `.env` 不存在或 DB_* 变量为空
**When** 服务初始化
**Then** 控制台输出配置向导提示，说明需要创建 `.env` 文件并填写数据库信息
**And** 提供 `.env.example` 的路径引导，输出格式：`⚠️ 请复制 .env.example 为 .env 并填写数据库连接信息，然后重新启动服务`
**And** 服务不启动（退出进程，exit code 1）

**Given** `.env` 中数据库配置存在但连接失败
**When** 服务尝试建立数据库连接池
**Then** 控制台输出：`❌ 数据库连接失败：[错误原因]，请检查 .env 中的 DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME 配置`
**And** 服务不启动（退出进程，exit code 1）

**Given** 数据库连接成功但表不存在
**When** 服务启动时执行表检查
**Then** 控制台输出：`📦 检测到数据库为空，请执行初始化：node migrations/init.js`
**And** 服务不启动（退出进程，exit code 1）

**Given** 所有配置正常
**When** 服务启动成功
**Then** 控制台输出：`✅ 外卖决策器启动成功，监听端口 [PORT]`

**Epic 7 总 Stories：7 个，覆盖 NFR-01~10 ✅**

---

## 汇总

| Epic | 名称 | Stories数 | 覆盖需求 |
|------|------|----------|---------|
| Epic 1 | 餐厅库管理 | 18 | FR-00, FR-05~09, ARCH-01~08 |
| Epic 2 | 转盘决策流程 | 9 | FR-01~03, FR-15（转盘）|
| Epic 3 | 扫雷决策流程 | 4 | FR-04, FR-15（扫雷）|
| Epic 4 | 个性化设置 | 2 | FR-14 |
| Epic 5 | 历史沉淀与智能过滤 | 6 | FR-10~13 |
| Epic 6 | 多人实时协作决策 | 12 | FR-16~19 |
| Epic 7 | 上线就绪与质量打磨 | 7 | NFR-01~10 |
| **合计** | | **58 个 Stories** | **所有 FR/NFR/ARCH ✅** |

