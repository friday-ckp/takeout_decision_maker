---
title: "API Design: takeout_decision_maker"
type: api-design
phase: 3-solutioning
status: complete
created: "2026-03-27"
updated: "2026-03-27"
author: Friday
project: takeout_decision_maker
inputDocuments:
  - _bmad-output/planning-artifacts/architecture-takeout_decision_maker.md
  - _bmad-output/planning-artifacts/prd-takeout_decision_maker.md
---

# 外卖点餐决策器 API 设计文档

**版本**: v0.5
**技术栈**: Node.js (Express) + MySQL + WebSocket
**基础路径**: `/api`
**日期**: 2026-03-27

---

## 目录

1. [通用约定](#通用约定)
2. [餐厅管理 Restaurants](#餐厅管理-restaurants)
3. [候选列表 Candidates](#候选列表-candidates)
4. [决策历史 Decision History](#决策历史-decision-history)
5. [每日配置 Daily Config](#每日配置-daily-config)
6. [系统设置 Settings](#系统设置-settings)
7. [多人会话 Sessions](#多人会话-sessions)
8. [WebSocket 事件](#websocket-事件)

---

## 通用约定

### 认证

> 当前版本为本地单用户模式，`user_id` 通过请求头传递。多人会话通过 `share_token` 识别。

```
X-User-Id: 1
```

### 统一响应格式

**成功响应**

```json
{
  "code": 0,
  "message": "success",
  "data": { }
}
```

**错误响应**

```json
{
  "code": 40001,
  "message": "错误描述",
  "data": null
}
```

### 通用错误码

| HTTP 状态码 | code  | 说明               |
| ----------- | ----- | ------------------ |
| 400         | 40001 | 请求参数错误       |
| 404         | 40401 | 资源不存在         |
| 409         | 40901 | 资源冲突（已存在） |
| 500         | 50001 | 服务器内部错误     |

### 分页参数（适用于列表接口）

| 参数   | 类型   | 默认值 | 说明     |
| ------ | ------ | ------ | -------- |
| page   | number | 1      | 页码     |
| limit  | number | 20     | 每页数量 |

---

## 餐厅管理 Restaurants

### 1. 获取餐厅列表

**`GET /api/restaurants`**

返回当前用户的餐厅列表，自动排除已软删除和已拉黑的餐厅。

**Query 参数**

```json
{
  "page": 1,
  "limit": 20,
  "category": "string (可选，分类筛选)",
  "tags": "string (可选，逗号分隔的标签，如 '辣,快')",
  "keyword": "string (可选，名称模糊搜索)"
}
```

**响应 200**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "list": [
      {
        "id": 1,
        "name": "海底捞",
        "category": "火锅",
        "tags": ["辣", "聚餐"],
        "note": "周末人多",
        "isFavorite": true,
        "createdAt": "2026-01-01T08:00:00Z",
        "updatedAt": "2026-03-01T12:00:00Z"
      }
    ]
  }
}
```

---

### 2. 创建餐厅

**`POST /api/restaurants`**

**Request Body**

```json
{
  "name": "string (必填，最长 50 字)",
  "category": "string (可选，最长 20 字)",
  "tags": ["string"],
  "note": "string (可选，最长 200 字)"
}
```

**响应 201**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 10,
    "name": "麦当劳",
    "category": "快餐",
    "tags": ["快", "便宜"],
    "note": "",
    "isFavorite": false,
    "createdAt": "2026-03-27T10:00:00Z",
    "updatedAt": "2026-03-27T10:00:00Z"
  }
}
```

**错误**

| code  | 说明               |
| ----- | ------------------ |
| 40001 | name 为空或超长    |
| 40901 | 同名餐厅已存在     |

---

### 3. 更新餐厅

**`PUT /api/restaurants/:id`**

**Request Body**（所有字段可选，仅更新传入字段）

```json
{
  "name": "string",
  "category": "string",
  "tags": ["string"],
  "note": "string"
}
```

---

### 4. 软删除餐厅

**`DELETE /api/restaurants/:id`**

设置 `deleted_at` 时间戳，不物理删除。

---

### 5. 回收站列表

**`GET /api/restaurants/trash`**

返回当前用户已软删除的餐厅。访问时自动清理 7 天前的记录（惰性触发）。

---

### 6. 从回收站恢复

**`POST /api/restaurants/:id/restore`**

清除 `deleted_at`，将餐厅恢复到正常列表。

---

### 7. 批量导入

**`POST /api/restaurants/import`**

**Request Body**

```json
{
  "restaurants": [
    {
      "name": "string (必填)",
      "category": "string (可选)",
      "tags": ["string"],
      "note": "string (可选)"
    }
  ]
}
```

**响应 200**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "total": 10,
    "imported": 8,
    "skipped": 2,
    "skippedNames": ["海底捞", "麦当劳"]
  }
}
```

---

### 8. 切换收藏状态

**`POST /api/restaurants/:id/favorite`**

若已收藏则取消，若未收藏则添加。不影响拉黑状态。

---

### 9. 切换拉黑状态

**`POST /api/restaurants/:id/blacklist`**

若已拉黑则移出黑名单，若未拉黑则加入。拉黑时自动清除收藏。

---

## 候选列表 Candidates

### 获取候选餐厅列表

**`GET /api/candidates`**

根据当日心情、口味标签、历史记录等条件，返回加权后的候选餐厅列表。

**Query 参数**

```json
{
  "mood": "string (可选)",
  "flavorTags": "string (可选，逗号分隔)",
  "excludeHistory": "boolean (可选，默认 true)",
  "limit": "number (可选，默认 16，转盘模式传 16，扫雷模式传 12)"
}
```

**响应 200**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "candidates": [
      {
        "id": 1,
        "name": "海底捞",
        "category": "火锅",
        "tags": ["辣"],
        "isFavorite": true,
        "weight": 3.5,
        "recentCount": 0
      }
    ],
    "total": 9
  }
}
```

---

## 决策历史 Decision History

### 1. 获取历史记录

**`GET /api/history`**

返回最近 30 条决策记录（默认）。

### 2. 记录决策结果

**`POST /api/history`**

用户在结果页确认后调用，写入一条决策记录。

**Request Body**

```json
{
  "restaurantId": "number (必填)",
  "mode": "string (必填，wheel | minesweeper)",
  "mood": "string (可选)",
  "flavorTags": ["string"]
}
```

---

## 每日配置 Daily Config

### 1. 获取今日配置

**`GET /api/daily-config`**

若当天记录不存在，自动创建默认配置后返回。跨日时自动重置 replay_count 和心情字段。

### 2. 更新今日配置

**`PATCH /api/daily-config`**

**Request Body**（所有字段可选）

```json
{
  "mood": "string (可选)",
  "flavorTags": ["string"],
  "incrementReplay": "boolean (可选，默认 false)"
}
```

---

## 系统设置 Settings

### 1. 获取所有设置

**`GET /api/settings`**

### 2. 更新单项设置

**`PUT /api/settings/:key`**

**允许的 key 列表**

| key                | 说明                           | 默认值 |
| ------------------ | ------------------------------ | ------ |
| theme              | 主题（light/dark）             | light  |
| defaultMode        | 默认决策模式（solo/multi）     | solo   |
| soundEnabled       | 是否开启音效（true/false）     | true   |
| historyExcludeDays | 历史排除天数                   | 7      |
| maxReplayCount     | 每日最大重玩次数               | 3      |

---

## 多人会话 Sessions

### 1. 创建会话

**`POST /api/sessions`**

由 host 创建多人决策会话，返回 `share_token`。

**Request Body**

```json
{
  "mode": "string (必填，multi)",
  "expiresInMinutes": "number (可选，默认 1440，即24小时)"
}
```

### 2. 获取会话信息

**`GET /api/sessions/:token`**

### 3. 加入会话

**`POST /api/sessions/:token/join`**

**Request Body**

```json
{
  "nickname": "string (必填，最长 20 字)"
}
```

### 4. 开始决策

**`POST /api/sessions/:token/start`**

仅 host 可调用。将状态从 `waiting` 变为 `deciding`，生成候选快照并广播。

### 5. 确认结果

**`POST /api/sessions/:token/confirm`**

仅 host 可调用。确认结果，状态置为 `done`，写入 `decision_history`。

---

## WebSocket 事件

### 连接方式

```
ws://host/ws/sessions/:token?nickname=<nickname>
```

### 事件汇总

| 事件名             | 方向             | 说明                         |
| ------------------ | ---------------- | ---------------------------- |
| participant_joined | server → client  | 有新成员加入会话             |
| session_state      | server → client  | 会话完整状态同步             |
| deciding_started   | server → client  | host 已开始决策，推送候选    |
| cell_clicked       | client → server  | 参与者点击格子（扫雷模式）   |
| wheel_started      | client → server  | 参与者触发转盘旋转           |
| result_revealed    | server → client  | 揭晓结果                     |
| session_done       | server → client  | host 确认结果，会话结束      |

### 事件 Payload 概要

**`deciding_started`（server → client）**
```json
{
  "event": "deciding_started",
  "data": {
    "sessionId": "abc123",
    "status": "deciding",
    "candidateSnapshot": [
      { "id": 1, "name": "海底捞", "weight": 3.5 }
    ]
  }
}
```

**`result_revealed`（server → client）**
```json
{
  "event": "result_revealed",
  "data": {
    "sessionId": "abc123",
    "resultRestaurantId": 1,
    "resultRestaurantName": "海底捞"
  }
}
```

**`session_done`（server → client）**
```json
{
  "event": "session_done",
  "data": {
    "sessionId": "abc123",
    "status": "done",
    "resultRestaurantId": 1,
    "resultRestaurantName": "海底捞"
  }
}
```
