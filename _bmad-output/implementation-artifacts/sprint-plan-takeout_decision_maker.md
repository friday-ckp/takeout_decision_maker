---
title: "Sprint Plan: takeout_decision_maker"
type: sprint-status
phase: 4-implementation
status: ready
version: "1.0"
created: "2026-03-27"
updated: "2026-03-27"
author: Friday
project: takeout_decision_maker
inputDocuments:
  - _bmad-output/planning-artifacts/prd-takeout_decision_maker.md
  - _bmad-output/planning-artifacts/architecture-takeout_decision_maker.md
  - _bmad-output/planning-artifacts/epics-takeout_decision_maker.md
sprints:
  - id: sprint-1
    status: not-started
    points: 35
    stories: 18
  - id: sprint-2
    status: not-started
    points: 38
    stories: 21
  - id: sprint-3
    status: not-started
    points: 34
    stories: 19
totalPoints: 107
totalStories: 58
---

# 外卖点餐决策器 Sprint 计划
> 基于 PRD v0.5 | 制定日期：2026-03-27

---

## 总览表

| Sprint | 时间周期 | 核心目标 | 覆盖 Epic | Stories | 故事点合计 |
|--------|----------|----------|-----------|---------|------------|
| Sprint 1 | W1–W2（2周） | 单人转盘决策完整链路 | Epic 1（1.1~1.9）+ Epic 2（2.1~2.9） | 18 个 | 35 pts |
| Sprint 2 | W3–W4（2周） | 扫雷 + 餐厅管理 + 历史过滤 + 设置 | Epic 1（1.10~1.18）+ Epic 3~5 | 21 个 | 38 pts |
| Sprint 3 | W5–W6（2周） | 多人实时协作 + 打磨上线 | Epic 6~7 | 19 个 | 34 pts |

**总故事点：107 pts ｜ 总 Stories：58 个**

> 详细 Epic / Story 拆解见：[epics-takeout_decision_maker.md](../_bmad-output/planning-artifacts/epics-takeout_decision_maker.md)
> 本 Sprint 计划共 **58 个可执行 Story**，分布如下表。

---

## Epic → Sprint 映射总览

| Epic | Sprint | Stories | 说明 |
|------|--------|---------|------|
| Epic 1（1.1~1.9） | Sprint 1 | 9 个 | 基础设施 + 添加餐厅核心流 |
| Epic 2（2.1~2.9） | Sprint 1 | 9 个 | 转盘决策全流程 |
| Epic 1（1.10~1.18） | Sprint 2 | 9 个 | 批量导入 + 编辑/删除/收藏/拉黑 |
| Epic 3（3.1~3.4） | Sprint 2 | 4 个 | 扫雷决策流程 |
| Epic 4（4.1~4.2） | Sprint 2 | 2 个 | 个性化设置 |
| Epic 5（5.1~5.6） | Sprint 2 | 6 个 | 历史沉淀与智能过滤 |
| Epic 6（6.1~6.12） | Sprint 3 | 12 个 | 多人实时协作决策 |
| Epic 7（7.1~7.7） | Sprint 3 | 7 个 | 上线就绪与质量打磨 |
| **合计** | | **58 个** | |

---

## Sprint 1：单人核心决策流程

**周期：** 2026-03-30 ~ 2026-04-10（2周）
**状态：** done

### Sprint 目标

搭建项目基础骨架，实现单人转盘决策完整链路：用户能在空状态引导下添加餐厅、进入模式选择页选择转盘、完成旋转决策并在结果页确认（扫雷模式在 Sprint 2 实现）。

---

### Story 列表

> 完整验收标准（Given/When/Then）见：[epics-takeout_decision_maker.md](../planning-artifacts/epics-takeout_decision_maker.md)

#### Epic 1：餐厅库管理（基础部分 1.1~1.9）

| Story | 标题 | 涵盖需求 | 估点 | 状态 |
|-------|------|----------|------|------|
| 1.1 | 项目骨架初始化与环境配置 | ARCH-01, ARCH-08 | 1 | done |
| 1.2 | 数据库初始化脚本（DDL Migrations） | ARCH-01, ARCH-02 | 3 | done |
| 1.3 | Express 后端骨架（路由/中间件/连接池） | ARCH-03 | 2 | done |
| 1.4 | 前端静态文件框架（HTML/CSS/JS） | ARCH-07, NFR-10 | 2 | done |
| 1.5 | 获取餐厅列表 API | FR-01 | 2 | done |
| 1.6 | 餐厅列表页（前端） | FR-01 | 1 | done |
| 1.7 | 空状态引导 | FR-00, UX-DR1 | 1 | done |
| 1.8 | 添加单个餐厅 API | FR-05 | 2 | done |
| 1.9 | 添加餐厅表单页（前端） | FR-05 | 2 | done |

**Epic 1（Sprint 1 部分）小计：16 pts**

---

#### Epic 2：转盘决策流程（2.1~2.9）

| Story | 标题 | 涵盖需求 | 估点 | 状态 |
|-------|------|----------|------|------|
| 2.1 | 候选列表 API（含权重算法） | FR-03, FR-08 | 3 | done |
| 2.2 | 每日配置 API（daily_config + 跨日重置） | FR-03, FR-14 | 2 | done |
| 2.3 | 首页决策入口 | FR-01, UX-DR1 | 1 | done |
| 2.4 | 模式选择页 | FR-02 | 2 | done |
| 2.5 | 转盘候选数据构建（权重 + >16 勾选逻辑） | FR-03, UX-DR2 | 3 | done |
| 2.6 | 转盘 Canvas 渲染 | FR-03, UX-DR3 | 2 | done |
| 2.7 | 转盘旋转动画与结果逻辑 | FR-03 | 2 | done |
| 2.8 | 结果页 — 单人转盘模式 | FR-15, UX-DR5 | 2 | done |
| 2.9 | 决策历史记录 API（基础版） | FR-10 | 2 | done |

**Epic 2 小计：19 pts**

---

### Sprint 1 Definition of Done

- [ ] Story 1.1~1.9 + 2.1~2.9 所有 Given/When/Then 验收标准通过
- [ ] 后端 API 统一响应格式 `{code, message, data}`，异常返回标准错误码
- [ ] 前端在 Chrome / Safari 最新版本测试通过
- [ ] 数据库 DDL 脚本可重复执行（`IF NOT EXISTS`）
- [ ] 核心流程（添加餐厅 → 转盘决策 → 查看结果）可完整端到端运行

**Sprint 1 总估点：35 pts**

---

## Sprint 2：餐厅管理 + 历史 + 过滤 + 设置

**周期：** 2026-04-13 ~ 2026-04-24（2周）
**状态：** not-started

### Sprint 目标

完善餐厅全生命周期管理，实现心情/口味智能过滤，沉淀决策历史，提供全局个性化设置，让单人体验完整闭环。

---

### Story 列表

> 完整验收标准（Given/When/Then）见：[epics-takeout_decision_maker.md](../planning-artifacts/epics-takeout_decision_maker.md)

#### Epic 1：餐厅库管理（进阶部分 1.10~1.18）

| Story | 标题 | 涵盖需求 | 估点 | 状态 |
|-------|------|----------|------|------|
| 1.10 | JSON 批量导入 API | FR-05 | 2 | not-started |
| 1.11 | JSON 批量导入前端 UI | FR-05 | 1 | not-started |
| 1.12 | 编辑餐厅 API + 前端 | FR-06 | 2 | not-started |
| 1.13 | 软删除餐厅 + 回收站 API | FR-07, ARCH-05 | 2 | not-started |
| 1.14 | 回收站页面（前端） | FR-07 | 1 | not-started |
| 1.15 | 收藏 / 取消收藏 | FR-08 | 2 | not-started |
| 1.16 | 收藏列表页（前端） | FR-08 | 1 | not-started |
| 1.17 | 拉黑 / 解除拉黑 | FR-09 | 2 | not-started |
| 1.18 | 黑名单页面（前端） | FR-09 | 1 | not-started |

**Epic 1（Sprint 2 部分）小计：14 pts**

---

#### Epic 3：扫雷决策流程（3.1~3.4）

| Story | 标题 | 涵盖需求 | 估点 | 状态 |
|-------|------|----------|------|------|
| 3.1 | 扫雷格子数据构建（权重算法） | FR-04, FR-08 | 2 | not-started |
| 3.2 | 扫雷格子布局与翻牌动画（前端） | FR-04, UX-DR4 | 3 | not-started |
| 3.3 | 结果页 — 扫雷模式适配 | FR-04, FR-15 | 2 | not-started |
| 3.4 | 模式选择页激活扫雷入口 | FR-02 | 1 | not-started |

**Epic 3 小计：8 pts**（注：扫雷权重单元测试包含在 3.1 验收标准中）

---

#### Epic 4：个性化设置（4.1~4.2）

| Story | 标题 | 涵盖需求 | 估点 | 状态 |
|-------|------|----------|------|------|
| 4.1 | 设置 API | FR-14 | 2 | not-started |
| 4.2 | 设置页（前端） | FR-14 | 2 | not-started |

**Epic 4 小计：4 pts**

---

#### Epic 5：历史沉淀与智能过滤（5.1~5.6）

| Story | 标题 | 涵盖需求 | 估点 | 状态 |
|-------|------|----------|------|------|
| 5.1 | 历史记录列表 API + 页面 | FR-10 | 2 | not-started |
| 5.2 | 历史排除逻辑集成 | FR-11, ARCH-05 | 3 | not-started |
| 5.3 | 心情过滤后端逻辑 | FR-12 | 2 | not-started |
| 5.4 | 心情选择器前端 | FR-12, UX-DR6 | 2 | not-started |
| 5.5 | 口味偏好过滤后端逻辑 | FR-13 | 2 | not-started |
| 5.6 | 口味偏好前端（模式选择页） | FR-13 | 1 | not-started |

**Epic 5 小计：12 pts**

---

### Sprint 2 Definition of Done

- [ ] Story 1.10~1.18 + 3.1~3.4 + 4.1~4.2 + 5.1~5.6 所有 Given/When/Then 验收标准通过
- [ ] 扫雷模式与转盘模式可在模式选择页切换，两条路径均完整可用
- [ ] 心情/口味过滤降级逻辑有前端友好提示
- [ ] 软删除回收站 7 天惰性清理可验证

**Sprint 2 总估点：38 pts**

---

## Sprint 3：多人实时协作 + 打磨上线

**周期：** 2026-04-27 ~ 2026-05-08（2周）
**状态：** not-started

### Sprint 目标

实现多人 WebSocket 实时协作决策全流程，完成产品体验打磨、性能优化及上线准备。

---

### Story 列表

> 完整验收标准（Given/When/Then）见：[epics-takeout_decision_maker.md](../planning-artifacts/epics-takeout_decision_maker.md)

#### Epic 6：多人实时协作决策（6.1~6.12）

| Story | 标题 | 涵盖需求 | 估点 | 状态 |
|-------|------|----------|------|------|
| 6.1 | WebSocket 服务器骨架 | ARCH-04 | 2 | not-started |
| 6.2 | 创建会话 API + 候选快照 | FR-16, ARCH-06 | 2 | not-started |
| 6.3 | 分享链接生成与复制（前端） | FR-16 | 1 | not-started |
| 6.4 | 加入会话 API + 临时用户创建 | FR-17 | 2 | not-started |
| 6.5 | 受邀者昵称输入页（前端） | FR-17 | 1 | not-started |
| 6.6 | 等待室实时参与者列表 | FR-18, UX-DR7 | 2 | not-started |
| 6.7 | WS 等待室事件（participant_joined / session_state） | FR-18 | 2 | not-started |
| 6.8 | 开始决策广播（deciding_started） | FR-19 | 2 | not-started |
| 6.9 | 多人转盘 — 同步控制 | FR-19 | 3 | not-started |
| 6.10 | 多人扫雷 — 先到先得 | FR-19 | 3 | not-started |
| 6.11 | 多人结果页与会话确认 | FR-19, FR-15 | 2 | not-started |
| 6.12 | WebSocket 断线重连 | NFR-05 | 2 | not-started |

**Epic 6 小计：24 pts**

---

#### Epic 7：上线就绪与质量打磨（7.1~7.7）

| Story | 标题 | 涵盖需求 | 估点 | 状态 |
|-------|------|----------|------|------|
| 7.1 | 首屏性能优化 | NFR-01, NFR-02 | 2 | not-started |
| 7.2 | 移动端响应式适配 | NFR-09 | 1 | not-started |
| 7.3 | 全局错误边界处理 | NFR-08 | 1 | not-started |
| 7.4 | 跨浏览器兼容验证 | NFR-08 | 1 | not-started |
| 7.5 | WebSocket 并发压测 | NFR-03, NFR-04 | 1 | not-started |
| 7.6 | 上线 Checklist 与部署文档 | NFR-07 | 2 | not-started |
| 7.7 | 首次使用数据库配置向导 | NFR-06 | 2 | not-started |

**Epic 7 小计：10 pts**

---

### Sprint 3 Definition of Done

- [ ] Story 6.1~6.12 + 7.1~7.7 所有 Given/When/Then 验收标准通过
- [ ] 多人完整链路（创建会话 → 受邀者加入 → 等待室 → 同步决策 → 结果确认）可端到端运行
- [ ] WebSocket 10 人并发压测通过，广播延迟 < 500ms
- [ ] 首屏加载 FCP < 2s（本地网络），API P95 < 200ms
- [ ] 375px 最小宽度下所有主要页面无布局错乱
- [ ] .env 不提交到 git（.gitignore 验证）

**Sprint 3 总估点：34 pts**

---

## 总体风险与依赖

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| WebSocket 服务器部署复杂度 | Sprint 3 延期 | Sprint 2 末期提前搭建 WS 框架 |
| 心情/口味过滤逻辑复杂 | Sprint 2 超期 | FR-12/FR-13 可降级为纯标签过滤 |
| 多人同步动画帧对齐 | 用户体验差 | 服务端统一 countdown + 客户端时间戳对齐 |
| MySQL 并发写入瓶颈 | 多人房间数据竞争 | 决策结果写入加行锁或用 Redis 暂存 |

---

## 技术栈备忘

```
后端:  Node.js (Express) + MySQL + WebSocket (ws 库)
前端:  原生 HTML / CSS / JavaScript (无框架)
部署:  单机 / VPS，Nginx 反向代理
DB:    MySQL 8.0+，使用事务保障决策原子性
WS:    ws@8.x，房间状态存 Memory Map（单进程），后续可迁移 Redis
```
