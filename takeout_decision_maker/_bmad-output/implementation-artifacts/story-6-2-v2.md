---
story_id: "6-2-v2"
title: "创建会话 API 重写（自选餐厅 + 截止时间）"
epic: "epic-6"
sprint: "sprint-4"
status: "in-progress"
branch: "story/6-2-v2-create-session-api-rewrite"
estimated_points: 3
---

# Story 6.2-v2：创建会话 API 重写（自选餐厅 + 截止时间）

## User Story

As a 发起人,
I want 创建一个多人决策会话并获得分享链接,
So that 可以邀请朋友加入一起投票决定今天吃什么。

## 需求变更说明（v2 重写）

- **移除**：`mode` 参数（`wheel` / `minesweeper`）
- **新增**：`selectedRestaurantIds`（发起人自选 2~20 家餐厅）
- **新增**：`deadlineAt`（投票截止时间）
- **响应新增**：`deadlineAt` 字段

## Acceptance Criteria

**AC1 — 正常创建**
- **Given** 发起人提供 selectedRestaurantIds（2~20，均属发起人餐厅库）和 deadlineAt（晚于当前时间）
- **When** `POST /api/sessions { selectedRestaurantIds:[1,2,3], deadlineAt:"2026-03-30T18:00:00Z" }`
- **Then** 返回 201，含 `{shareToken, expiresAt, sessionId, deadlineAt}`
- **And** 将选定餐厅存入 `candidate_snapshot`（格式 `[{id,name,category}]`，不带权重展开）
- **And** `decision_sessions.deadline_at` 写入 deadlineAt
- **And** 发起人已插入 `session_participants`（role='host'）

**AC2 — 餐厅数量不足**
- **Given** selectedRestaurantIds 少于 2 家
- **Then** 返回 400，`{code:40002, message:"至少选择2家餐厅"}`

**AC3 — 超出上限**
- **Given** selectedRestaurantIds 超过 20 家
- **Then** 返回 400，`{code:40004, message:"最多选择20家餐厅"}`

**AC4 — 截止时间无效**
- **Given** deadlineAt 早于或等于当前时间
- **Then** 返回 400，`{code:40003, message:"截止时间必须晚于当前时间"}`

**AC5 — 餐厅不属于用户**
- **Given** selectedRestaurantIds 含有不属于该用户或已软删除的餐厅 id
- **Then** 返回 400，`{code:40005, message:"包含无效的餐厅ID"}`

**AC6 — 会话状态查询（GET /api/sessions/:token/state）**
- **Given** 会话刚创建
- **Then** 返回的 `participants` 列表中发起人 role='host'，无需再调用 join

## 技术实现要点

- 修改 `backend/src/controllers/sessionsController.js` 中 `createSession`
- DB 迁移已完成（`deadline_at` 字段已存在，`mode` 已移除）
- `candidate_snapshot` 存原始列表（不展开权重），`[{id, name, category}]`
- 参数校验顺序：数量 → 截止时间 → 餐厅归属验证
- 需要 `requireAuth` 中间件（已有）

## 测试要点

- `tests/integration/sessions.test.js` 新增 `POST /api/sessions` 正常路径及各 AC 的测试
- mock `pool.query` 按调用顺序返回
