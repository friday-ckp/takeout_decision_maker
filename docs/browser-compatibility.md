# 跨浏览器兼容性验证报告

> Story 7.4 | 版本 1.0 | 2026-03-28

## 目标浏览器

| 浏览器 | 最低版本 | 测试状态 |
|--------|----------|----------|
| Chrome | 最新版 (124+) | ✅ 通过 |
| Safari | 最新版 (17+) | ✅ 通过 |
| Firefox | 最新版 (125+) | ✅ 通过 |
| Edge | 最新版 (124+) | ✅ 通过 |
| iOS Safari | 15+ | ✅ 通过 |
| Android Chrome | 最新版 | ✅ 通过 |

## 已识别问题与修复

### 1. CSS 3D 翻转动画（扫雷格子）

**问题：** `transform-style: preserve-3d`、`backface-visibility`、`perspective` 在部分 WebKit 内核浏览器（Safari < 15.4）需要 `-webkit-` 前缀。

**修复位置：** `frontend/pages/index.html`（扫雷内联样式）

```css
/* 修复前 */
perspective: 500px;
transform-style: preserve-3d;
backface-visibility: hidden;

/* 修复后 */
-webkit-perspective: 500px;
perspective: 500px;
-webkit-transform-style: preserve-3d;
transform-style: preserve-3d;
-webkit-backface-visibility: hidden;
backface-visibility: hidden;
```

### 2. `user-select` 属性

**问题：** 旧版 Firefox / Safari 需要 `-moz-`、`-webkit-` 前缀。

**修复位置：** `frontend/styles/main.css`（`.btn`、`.chip` 选择器）

```css
/* 修复后 */
-webkit-user-select: none;
-moz-user-select: none;
-ms-user-select: none;
user-select: none;
```

### 3. `transition` + `-webkit-transform` 联动

**问题：** 翻牌动画 transition 需同时声明 `-webkit-transform`。

**修复：** `.mine-cell__inner` 的 `transition` 属性补充了 vendor-prefixed 版本。

## 未存在问题的特性（已确认兼容）

| 特性 | 支持范围 | 说明 |
|------|----------|------|
| CSS Variables | Chrome 49+, Safari 9.1+ | 已普遍支持 |
| CSS Grid / Flexbox | Chrome 57+, Safari 10.1+ | 已普遍支持 |
| Canvas 2D API | 所有现代浏览器 | 用于转盘绘制，兼容良好 |
| WebSocket | Chrome 16+, Safari 7+ | 已普遍支持 |
| Fetch API | Chrome 42+, Safari 10.1+ | 已普遍支持 |
| Optional Chaining `?.` | Chrome 80+, Safari 13.1+ | 目标版本均支持 |
| Nullish Coalescing `??` | Chrome 80+, Safari 13.1+ | 目标版本均支持 |
| Async/Await | Chrome 55+, Safari 10.1+ | 已普遍支持 |
| `aspect-ratio` | Chrome 88+, Safari 15+ | 目标版本均支持 |
| `-webkit-text-size-adjust` | 已添加前缀 | 移动端字体缩放防护 |
| `-webkit-font-smoothing` | 已添加 | macOS/iOS 字体渲染优化 |

## 移动端适配（NFR-09）

- viewport meta 已配置：`width=device-width, initial-scale=1.0`
- 375px 最小宽度布局验证：所有主要页面无横向溢出
- 触控事件：使用标准 `click` 事件，触屏等效支持
- `-webkit-text-size-adjust: 100%` 防止 iOS 横竖屏字体自动缩放

## 验证检查清单

- [x] 扫雷翻牌 3D 动画在 Safari 正常显示
- [x] 转盘 Canvas 绘制在 Chrome/Safari/Firefox 一致
- [x] WebSocket 连接在 Safari 正常建立
- [x] CSS 动画（blob 浮动、toast、参与者入场）在各浏览器流畅
- [x] 按钮 `user-select: none` 阻止文本选中
- [x] 响应式布局在 375px 宽度下无布局错乱
- [x] Emoji 显示在各平台正常（使用系统字体栈）
