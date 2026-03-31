# Story 8.9: 导航栏用户状态区域

## Story Info

| 字段 | 值 |
|------|----|
| Story ID | 8.9 |
| Story Key | `8-9-nav-user-status` |
| Epic | Epic 8: 用户注册与登录 |
| Sprint | Sprint 4 |
| Status | ready-for-dev |
| Created | 2026-03-31 |
| Depends on | Story 8.5（auth.js + nav-auth-area DOM），Story 8.6（apiFetch） |

---

## User Story

**作为** 已登录用户，
**我希望** 在顶部导航栏看到默认头像、用户名，并能一键退出，
**以便** 随时确认当前登录身份并安全退出。

---

## 验收标准（Acceptance Criteria）

### AC-1: 已登录状态 — 头像 + 用户名 + 退出
- [ ] 顶部导航 `#nav-auth-area` 显示：灰色圆形头像（含用户名首字母大写）+ 用户名文字 + 「退出」按钮
- [ ] 头像为纯 CSS 实现（无图片依赖），背景色 `#7c7c8a`，白色首字母，尺寸 28×28px，圆形

### AC-2: 退出登录
- [ ] 点击「退出」按钮后：清除 `localStorage` 中 `authToken` 和 `authUser`，跳转 `/login`（调用已有 `logout()` 函数）

### AC-3: 未登录状态 — 显示「登录」入口
- [ ] `#nav-auth-area` 显示「登录」按钮，点击跳转 `login` 页

### AC-4: Bug 修复 — saveAuth 参数错误
- [ ] `authLogin` 和 `authRegister` 中的 `saveAuth` 调用修正为正确的用户对象（见「关键 Bug」）

---

## 关键 Bug：saveAuth 参数错误（必须修复）

### 问题

`auth.js` 第 53 行和第 66 行：
```js
// ❌ 错误：data.data.user 为 undefined
saveAuth(data.data.token, data.data.user);
```

**原因：** 后端 API 响应结构为：
```json
{ "code": 0, "data": { "token": "...", "userId": 1, "name": "张三" } }
```
用户数据在 `data.data` 本身，不存在 `data.data.user` 子对象。

因此 `getUser()` 始终返回 `null`，`updateNavUserState()` 从未渲染登录后的用户区域。

### 修复

```js
// ✅ 正确：authLogin（后端只返回 token + userId + name，无 email）
saveAuth(data.data.token, { userId: data.data.userId, name: data.data.name });

// ✅ 正确：authRegister（后端返回 token + userId + name + email）
saveAuth(data.data.token, { userId: data.data.userId, name: data.data.name, email: data.data.email });
```

**注意**：`getUser()` 读取 `AUTH_USER_KEY = 'authUser'`，`saveAuth()` 写入正确结构后即可工作。

---

## 技术规范

### 需修改的文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `frontend/scripts/auth.js` | **修改** | 修复 `saveAuth` 调用 + 更新 `updateNavUserState()` 以加入头像 HTML |
| `frontend/styles/main.css` | **修改** | 新增 `.nav-avatar` CSS 样式 |

**不需要修改：**
- `frontend/pages/index.html`：`#nav-auth-area` 已存在（第 815 行）
- `frontend/scripts/app.js`：`updateNavUserState()` 已在 DOMContentLoaded 中调用（第 181 行）

### 修改 1：auth.js — updateNavUserState()

```js
function updateNavUserState() {
  const user = getUser();
  const authArea = document.getElementById('nav-auth-area');
  if (!authArea) return;

  if (user) {
    const initial = (user.name || user.email || '?').charAt(0).toUpperCase();
    authArea.innerHTML = `
      <span class="nav-avatar" aria-hidden="true">${escapeHtml(initial)}</span>
      <button class="link-btn nav-username" id="goto-profile-btn" title="查看个人信息">${escapeHtml(user.name || user.email)}</button>
      <button class="btn btn--ghost btn--sm" id="logout-btn">退出</button>
    `;
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('goto-profile-btn').addEventListener('click', () => navigate('profile'));
  } else {
    authArea.innerHTML = `
      <button class="btn btn--ghost btn--sm" id="go-login-btn">登录</button>
    `;
    document.getElementById('go-login-btn').addEventListener('click', () => navigate('login'));
  }
}
```

### 修改 2：auth.js — saveAuth 调用修复

```js
// authLogin（第 53 行）：
saveAuth(data.data.token, { userId: data.data.userId, name: data.data.name });

// authRegister（第 66 行）：
saveAuth(data.data.token, { userId: data.data.userId, name: data.data.name, email: data.data.email });
```

### 修改 3：main.css — .nav-avatar 样式

在 `.nav-username` 附近追加：
```css
.nav-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #7c7c8a;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
  user-select: none;
}
```

---

## 现有代码参考

### index.html — nav-auth-area 位置（第 815 行）

```html
<div id="nav-auth-area" style="display:flex;align-items:center;gap:8px;margin-left:4px;"></div>
```

### app.js — 调用点（第 181 行）

```js
if (typeof updateNavUserState === 'function') updateNavUserState();
```

调用时机：DOMContentLoaded，auth.js 在 index.html 第 1587 行已加载，调用顺序无问题。

### main.css — 现有 .nav-username（第 454 行）

```css
.nav-username { font-size: 13px; color: #555; max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
```

`.nav-avatar` 新样式建议追加在 `.nav-username` 规则之前（紧邻）。

### 现有 .p-avatar 参考（多人协作参与者头像，第 338 行）

```css
.participant-item .p-avatar {
  /* 已有圆形头像样式，nav-avatar 设计与其保持一致 */
}
```

---

## 测试要求

手动验证（无需新增自动化测试，纯 UI 改动）：

- [ ] 注册新用户后，顶部导航显示头像（首字母）+ 用户名 + 「退出」按钮
- [ ] 登录已有用户后，同上
- [ ] 点击「退出」后跳转登录页，localStorage 中 `authToken` 和 `authUser` 已清除
- [ ] 未登录（清除 localStorage 后刷新），显示「登录」按钮
- [ ] 用户名超长时（>80px）文字省略不影响头像和退出按钮布局
- [ ] 移动端（375px 宽）：`.nav-username` 有 `max-width: 60px` 限制，头像仍正常显示

---

## Dev Notes（开发完成后填写）

---

## Status

- [x] Story 创建（ready-for-dev）
- [ ] 开发中（in-progress）
- [ ] 代码审查（review）
- [ ] 完成（done）
