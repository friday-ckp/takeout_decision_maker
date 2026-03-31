---
id: 6-3-v2
title: "发起投票前端（餐厅勾选 + 截止时间设置）"
epic: 6
sprint: 4
points: 3
status: in-progress
---

# Story 6.3-v2: 发起投票前端（餐厅勾选 + 截止时间设置）

## User Story

As a 发起人,
I want 在发起多人投票时，勾选候选餐厅并设置截止时间,
So that 参与者能公平投票选出今天吃什么。

## Acceptance Criteria

**AC1 — 入口**
- Given 首页「邀请朋友一起选」按钮
- When 点击
- Then 跳转到餐厅勾选页（SPA page: vote-setup），展示发起人全部餐厅列表（默认全选），顶部显示已选数量

**AC2 — 最少选择验证**
- Given 发起人在勾选页
- When 勾选数 < 2
- Then 「创建投票」按钮置灰，页面显示「至少选择2家餐厅」提示

**AC3 — 创建投票**
- Given 勾选 2~20 家餐厅 + 设置截止时间（默认今天 20:00）
- When 点击「创建投票」
- Then 调用 `POST /api/sessions` 携带 `{selectedRestaurantIds, deadlineAt}`，成功后显示分享链接

**AC4 — 分享链接展示**
- Given 会话创建成功拿到 shareToken
- Then 在 Lobby 页展示链接 `{BASE_URL}/session/{shareToken}/lobby`
- And 提供「一键复制」按钮，点击后 toast 提示「链接已复制」
- And 链接文字可点击，新标签页打开

## Technical Notes

- 移除旧的 `multi-mode-overlay`（转盘/扫雷模式选择）
- 新增 `page-vote-setup` SPA 页面（`frontend/pages/index.html`）
- 修改 `frontend/scripts/session.js`：
  - `btn-invite-friends` 点击 → `navigate('vote-setup')`
  - `onEnterVoteSetup()` 拉取 `/api/restaurants` 渲染勾选列表
  - `createVoteSession()` 收集选中 IDs + deadline → `POST /api/sessions`
- 截止时间默认：今天 20:00（`datetime-local` input）
- 无后端改动，后端 6.2-v2 已完成

## Files Changed

- `frontend/pages/index.html`
- `frontend/scripts/session.js`
