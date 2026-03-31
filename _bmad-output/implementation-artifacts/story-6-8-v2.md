---
id: 6-8-v2
title: "开始决策广播修改（移除 mode，加 deadlineAt）"
epic: 6
sprint: 4
points: 1
status: in-progress
---

# Story 6.8-v2: 开始决策广播修改（移除 mode，加 deadlineAt）

## User Story

As a 发起人,
I want 点击「开始决策」后所有参与者同步收到含截止时间的广播,
So that 客户端能进入投票页并倒计时。

## Acceptance Criteria

**AC1 — 广播内容**
- Given 发起人点击「开始决策」调用 `POST /api/sessions/:token/start`
- When 服务端广播 deciding_started
- Then 广播数据为 `{event:"deciding_started", data:{status:"deciding", candidateSnapshot:[...], deadlineAt:"..."}}`
- And 广播数据不包含 `mode` 字段

**AC2 — 客户端响应**
- Given 所有参与者（含发起人）收到 deciding_started 广播
- When 事件处理
- Then 保存 `deadlineAt` 到客户端状态 `sessionDeadlineAt`
- And `sessionMode` 设置为 `'vote'`
- And 页面跳转至 `vote` 决策页（由 Story 6.10-new 实现页面内容）

**AC3 — 重连恢复**
- Given 用户断线重连收到 session_state（status: deciding）
- When 处理 onSessionState
- Then 同样保存 deadlineAt，设置 sessionMode = 'vote'，跳转至 vote 页

## Technical Notes

- 后端 `startSession` 在 6.2-v2 中已完成广播修改（包含 deadlineAt，无 mode）
- 本 Story 主要变更为前端 `session.js`：
  - 新增 `let sessionDeadlineAt = null;` 状态变量
  - `onDecidingStarted(data)`: 移除 `data.mode` 引用，存 `deadlineAt`，导航到 `'vote'`
  - `onSessionState(data)`: 同步处理 deadlineAt，sessionMode = 'vote'
- `page-vote` SPA 页面由 Story 6.10-new 负责实现

## Files Changed

- `frontend/scripts/session.js`
