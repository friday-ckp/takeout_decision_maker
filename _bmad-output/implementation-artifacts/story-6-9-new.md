---
id: 6-9-new
title: "投票机制 API + WebSocket 事件"
epic: 6
sprint: 4
points: 3
status: in-progress
---

# Story 6.9-new: 投票机制 API + WebSocket 事件

## User Story

As a 多人会话参与者,
I want 提交我的餐厅选票并实时看到进度,
So that 每个人的偏好都能被公平统计。

## Acceptance Criteria

**AC1 — 提交投票**
- POST /api/sessions/:token/vote {restaurantId, restaurantName}
- 每人仅1票，重复提交覆盖旧票
- 广播 vote_updated: {votes:[{restaurantId,restaurantName,count}], totalVoters, votedCount}

**AC2 — 所有人投完自动结算**
- 最后一票提交后自动触发 vote_result
- vote_result: {winner:{restaurantId,restaurantName,count}, allVotes, isTie}

**AC3 — 截止时间 / close-vote**
- POST /api/sessions/:token/close-vote (requireAuth, 发起人)
- 统计当前票数，广播 vote_result
- 若无人投票，广播 no_votes

**AC4 — 平局随机选一**
- isTie: true, winner 为随机选一

**AC5 — 查询当前票数**
- GET /api/sessions/:token/votes → 实时票数数组

## Files Changed

- `backend/src/websocket/server.js`
- `backend/src/controllers/sessionsController.js`
- `backend/src/routes/sessions.js`
