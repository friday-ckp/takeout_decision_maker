---
title: "Sprint Change Proposal: 导航栏用户状态区域"
type: sprint-change-proposal
date: "2026-03-31"
project: takeout_decision_maker
sprint: sprint-4
status: approved
scope: minor
author: Capy (Scrum Master)
---

# Sprint Change Proposal：导航栏用户状态区域

> 项目：takeout_decision_maker ｜ Sprint 4 ｜ 2026-03-31

---

## Section 1：问题摘要

**问题描述：**
Epic 8（用户注册/登录）全部 Story 标记为 done 并完成回顾后，发现以下两处遗漏：

1. **退出登录入口缺失**：Story 8.5 的验收标准中明确要求"顶部导航栏显示用户名 + 「退出」按钮"，但实现时该功能被遗漏，导致已登录用户无法从导航栏退出。
2. **用户状态可视化缺失**：导航栏未显示默认头像和用户名，用户无法直观确认当前登录身份。

**发现时机：** Epic 8 回顾完成后，用户审查应用时发现。

**证据：**
- `epics-takeout_decision_maker.md` 第 1868 行：`Then 显示用户名 + 「退出」按钮；点击退出清除 localStorage，跳转 /login`
- Sprint 4 进行中，尚在变更窗口内。

---

## Section 2：影响分析

### Epic 影响

| Epic | 影响 | 说明 |
|------|------|------|
| Epic 8（用户认证） | 需重置为 in-progress | 新增 Story 8.9，完成后再标记 done |
| 其他 Epic | 无影响 | 纯前端 UI 追加，无跨 Epic 依赖 |

### Story 影响

| Story | 影响类型 | 说明 |
|-------|----------|------|
| 8.5（前端登录/注册页面） | 参考 | AC 已含退出逻辑，8.9 负责 nav 层实现，无需重开 |
| 8.9（新增） | 新建 | 导航栏用户状态区域，覆盖头像 + 用户名 + 退出 |

### 文档影响

| 文档 | 影响 | 操作 |
|------|------|------|
| PRD | 无冲突 | 无需修改 |
| Architecture | 无冲突 | 无需修改（纯前端组件） |
| UX Design | 轻微 | 可选补充顶部导航用户区域说明 |
| Epics | 需更新 | 追加 Story 8.9 定义 |
| sprint-status.yaml | 需更新 | Epic 8 回退 in-progress，新增 8.9 条目 |
| sprint-plan | 需更新 | Story 数 +1，故事点 +2 |

---

## Section 3：推荐方案

**选择方案：Option 1 — 直接调整（新增 Story）**

**理由：**
- 变更范围极小（纯前端 UI，约 2 pts）
- 不需要回滚任何已完成工作
- MVP 范围不受影响
- 开发风险低，无架构变动

**努力估计：** Low
**风险等级：** Low
**时间线影响：** Sprint 4 增加约半天工作量

---

## Section 4：具体变更提案

### 变更 1：新增 Story 8.9（Epics 文档）

**文件：** `_bmad-output/planning-artifacts/epics-takeout_decision_maker.md`

```
位置：Epic 8，Story 8.8 之后追加

### Story 8.9: 导航栏用户状态区域

As a 已登录用户,
I want 在顶部导航栏看到我的头像、用户名，并能一键退出，
So that 我能随时确认登录身份并安全退出。

**Acceptance Criteria:**

**Given** 已登录用户访问任意受保护页面
**When** 页面加载
**Then** 顶部导航栏右侧显示默认头像（灰色圆形 + 首字母）、用户名、「退出」按钮

**Given** 用户点击「退出」按钮
**When** 点击事件触发
**Then** 清除 localStorage 的 authToken 和 userName，跳转 /login

**Given** 顶部导航
**When** 用户未登录
**Then** 显示「登录」入口链接，不显示头像/用户名区域

估点：2 pts
```

**理由：** 保持 Epics 为 source of truth，8.9 需有正式验收标准。

---

### 变更 2：sprint-status.yaml

**文件：** `_bmad-output/implementation-artifacts/sprint-status.yaml`

```yaml
OLD:
  epic-8: done
  8-8-anonymous-join: done
  epic-8-retrospective: done

NEW:
  epic-8: in-progress
  8-8-anonymous-join: done
  8-9-nav-user-status: backlog
  epic-8-retrospective: done
```

---

### 变更 3：sprint-plan Story 列表 + 总览数据

**文件：** `_bmad-output/implementation-artifacts/sprint-plan-takeout_decision_maker.md`

```
Sprint 4 Story 表格新增：
| 8.9 | 导航栏用户状态区域 | FR-AUTH-NAV | 2 | backlog |

总览更新：
- Sprint 4 Stories: 14 → 15
- Sprint 4 Points: 34 → 36
- totalStories: 72 → 73
- totalPoints: 141 → 143
```

---

## Section 5：实施交接

**变更范围分类：** Minor（可由开发团队直接实现）

| 角色 | 职责 |
|------|------|
| Scrum Master | 更新 epics 文档、sprint-status.yaml、sprint-plan |
| Dev（bmad-dev-story） | 实现 Story 8.9 |
| Code Reviewer | 审查导航栏实现 |

**成功标准：**
- 顶部导航栏在登录状态下显示默认头像 + 用户名 + 退出按钮
- 点击退出后清除 token 并跳转 /login
- 未登录状态不显示用户信息区域

**依赖：** Story 8.5 已完成（authToken / userName 已存入 localStorage）

---

*本提案由 Capy (Scrum Master) 于 2026-03-31 生成，经用户逐项审批通过。*
