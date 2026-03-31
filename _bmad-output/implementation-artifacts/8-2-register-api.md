# Story 8.2: 注册 API

## Story Info

| 字段 | 值 |
|------|----|
| Story ID | 8.2 |
| Story Key | `8-2-register-api` |
| Epic | Epic 8: 用户注册与登录 |
| Sprint | Sprint 4 |
| Status | ready-for-dev |
| Created | 2026-03-31 |
| Depends on | Story 8.1（users.email / users.password_hash 已存在） |

---

## User Story

**作为** 新用户，
**我希望** 用邮箱和密码注册账号，
**以便** 以个人身份使用外卖决策器并保存我的餐厅数据。

---

## 验收标准（Acceptance Criteria）

### AC-1: 正常注册
- [ ] `POST /api/auth/register` 接受 `{ name, email, password }`
- [ ] bcrypt hash 密码（salt rounds = 10）
- [ ] 写入 users 表：`is_temp=false`，`email`，`password_hash`，`name`
- [ ] 返回 201：`{ userId, name, email, token }`
- [ ] token 为 JWT（payload: `{ userId }`，有效期 7 天，使用 `JWT_SECRET`）

### AC-2: 邮箱已注册
- [ ] email 已存在 → 409 `{ code: 40901, message: "邮箱已被注册" }`

### AC-3: 入参校验
- [ ] email 格式非法 → 400 `{ code: 40001, message: "邮箱格式不正确" }`
- [ ] password 长度 < 8 → 400 `{ code: 40002, message: "密码长度不能少于8位" }`
- [ ] name 为空 → 400 `{ code: 40003, message: "昵称不能为空" }`

### AC-4: 依赖包
- [ ] `package.json` 新增 `bcryptjs`（纯JS实现，无原生依赖）
- [ ] `package.json` 新增 `jsonwebtoken`

---

## 技术规范

### 路由注册

在 `backend/src/routes/index.js`（或等价入口）中注册：
```
POST /api/auth/register → authController.register
```

### 目录结构

| 文件 | 操作 |
|------|------|
| `backend/src/controllers/authController.js` | **新建** |
| `backend/src/routes/auth.js` | **新建** |
| `backend/src/routes/index.js` 或 `app.js` | **修改**（挂载 auth 路由） |
| `backend/package.json` | **修改**（新增 bcryptjs + jsonwebtoken） |

### 现有项目约定（需遵守）

查看现有 controller（如 `restaurantsController.js`）的响应格式：
- 成功：`success(res, data, message, statusCode)`
- 失败：`error(res, statusCode, code, message)`

JWT 生成示例：
```js
const jwt = require('jsonwebtoken');
const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
```

bcrypt 示例：
```js
const bcrypt = require('bcryptjs');
const hash = await bcrypt.hash(password, 10);
```

### 错误码约定

| 场景 | HTTP | code |
|------|------|------|
| 参数校验失败 | 400 | 4000x |
| 邮箱已注册 | 409 | 40901 |
| 服务器错误 | 500 | 50001 |

---

## 测试要求

新建 `backend/tests/integration/auth.test.js`，覆盖：
- [ ] 正常注册 → 201 + token + userId
- [ ] 重复邮箱 → 409
- [ ] 邮箱格式错误 → 400
- [ ] 密码太短 → 400
- [ ] name 为空 → 400

---

## Dev Notes（开发完成后填写）

---

## Status

- [x] Story 创建（ready-for-dev）
- [ ] 开发中（in-progress）
- [ ] 代码审查（review）
- [ ] 完成（done）
