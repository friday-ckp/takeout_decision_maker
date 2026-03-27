---
title: "UX Design: takeout_decision_maker"
type: ux-design
phase: 2-planning
status: complete
created: "2026-03-27"
updated: "2026-03-27"
author: Friday
project: takeout_decision_maker
inputDocuments:
  - _bmad-output/planning-artifacts/prd-takeout_decision_maker.md
artifacts:
  - wireframes-takeout_decision_maker.html
---

# UX 设计文档：外卖点餐决策器

## 概述

本文档记录外卖点餐决策器的 UX 设计产出。视觉线框图见附件 `wireframes-takeout_decision_maker.html`。

---

## 设计原则

1. **打开即决策** — 首屏无任何干扰，直接显示决策入口
2. **最短路径** — 从打开到得出结果不超过 3 步
3. **零干扰** — 无广告、无推荐流、无弹窗
4. **工具型** — 用户主导，系统不自作主张

---

## 页面架构

```
/ (首页)
├── /decide (模式选择)
│   ├── /decide/wheel (转盘决策)
│   ├── /decide/minesweeper (扫雷决策)
│   └── /decide/result (结果页)
├── /restaurants (餐厅管理)
│   ├── /restaurants/favorites (收藏)
│   └── /restaurants/blacklist (黑名单)
├── /history (历史记录)
├── /settings (设置)
└── /session/:token/lobby (多人等待室)
    └── /session/:token/decide (多人决策)
```

---

## 关键页面设计说明

### 首页 `/`

- **主视觉：** 「开始决策」大按钮居中，一眼可见
- **右上角：** 心情选择 icon（可选前置过滤）
- **空状态：** 无餐厅时替换为引导提示 + 「去添加餐厅」按钮

### 模式选择 `/decide`

- 两个大卡片：「转盘模式」和「扫雷模式」
- 卡片含图标和简短说明
- 底部提供「邀请朋友一起选」入口（多人）
- 可选前置：口味偏好标签选择

### 转盘候选勾选页（候选 > 16 时触发）`/decide/wheel/select`

> 触发条件：过滤后候选餐厅超过 16 个（含收藏2倍份额计算前）

- 以**餐厅为单位**展示列表（不展开收藏的双份，视觉上1行1家）
- 每项显示：餐厅名称 + 收藏标记 + 品类标签
- 默认全选，用户可取消勾选（取消即完全不参与转盘，含2倍权重）
- 底部显示「确认（N 家餐厅参与）」按钮，N 实时更新
- 勾选数量 < 2 时按钮置灰并提示「至少选 2 家餐厅」

### 转盘模式 `/decide/wheel`

- 转盘居中，餐厅名称等分扇形
- 收藏餐厅占 2 倍扇区（视觉上更宽）
- 「开始」按钮在转盘下方
- 结果高亮展示，随后跳转结果页

### 扫雷模式 `/decide/minesweeper`

- N 个翻扣格子网格布局
- 格子背面统一样式，正面翻开后显示餐厅名
- 第一个被点开的格子即为结果（动画揭晓）

### 结果页 `/decide/result`

- 餐厅名称大字居中（主视觉焦点）
- 品类、备注次要信息
- 「就这家了！」主按钮（绿色/强调色）
- 「换一个」次要按钮（有次数限制提示）

---

## 线框图

详见附件文件：[wireframes-takeout_decision_maker.html](./wireframes-takeout_decision_maker.html)

---

## 设计规范

- **主色调：** 待定（UX 阶段确认）
- **字体：** 系统默认中文字体
- **桌面优先，响应式设计**
- **圆角卡片风格，现代感**
- **高设计质量，避免 AI 通用审美**
