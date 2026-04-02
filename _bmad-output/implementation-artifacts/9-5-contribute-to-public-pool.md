# Story 9.5: 添加餐厅时支持选择"贡献至公共池"（仅登录用户）

## Story Info

| 字段 | 值 |
|------|----|
| Story ID | 9.5 |
| Story Key | `9-5-contribute-to-public-pool` |
| Epic | Epic 9: 公共餐厅池 |
| Sprint | Sprint 5 |
| Status | in-progress |
| Created | 2026-04-02 |
| Depends on | Story 9.1（is_public 字段），Story 9.2（公共池 API），Story 9.3（合并逻辑），Story 8.x（JWT 认证） |

---

## User Story

**作为** 已登录用户，
**我希望** 在添加餐厅时可以选择"贡献至公共池"，
**以便** 将我喜欢的餐厅分享给所有用户，共同丰富公共餐厅库。

---

## 验收标准（Acceptance Criteria）

### AC-1: 后端接受 contributeToPublic 参数
- [ ] `POST /api/restaurants` 接受可选字段 `contributeToPublic: boolean`
- [ ] 当 `contributeToPublic=true` 且用户已登录时，新餐厅 `is_public=1`，`owner_user_id=userId`
- [ ] 当 `contributeToPublic=false` 或不传时，新餐厅 `is_public=0`，`owner_user_id=userId`（默认个人私有）
- [ ] 非布尔值类型传入时忽略（fallback 为 false）

### AC-2: 前端显示"贡献至公共池"复选框
- [ ] 添加餐厅侧边面板中，备注字段下方显示"贡献至公共池"复选框，带简短说明文字
- [ ] 复选框**仅在用户已登录时显示**（`localStorage.getItem('authToken')` 非空）
- [ ] 未登录时该复选框隐藏
- [ ] 复选框默认未勾选

### AC-3: 前端正确传参
- [ ] 勾选"贡献至公共池"提交时，请求体包含 `contributeToPublic: true`
- [ ] 未勾选时，请求体包含 `contributeToPublic: false` 或不含该字段
- [ ] 添加成功后，复选框随表单一起清空（重置为默认未勾选）

### AC-4: 响应中返回 isPublic 字段
- [ ] 成功创建的餐厅响应体中包含 `isPublic: true/false`

---

## 技术实现笔记

### 后端修改

**文件：** `backend/src/controllers/restaurantsController.js`

在 `createRestaurant` 函数中：
1. 从 `req.body` 中解构 `contributeToPublic`
2. 计算 `isPublic = contributeToPublic === true ? 1 : 0`
3. 修改 INSERT 语句，将 `is_public` 和 `owner_user_id` 一并写入
4. 修改回查 SELECT，返回 `is_public AS isPublic`

```js
const { name, category = null, tags = [], notes = '', contributeToPublic = false } = req.body;
const isPublicVal = contributeToPublic === true ? 1 : 0;

// INSERT
'INSERT INTO restaurants (user_id, owner_user_id, name, category, tags, notes, is_public) VALUES (?, ?, ?, ?, ?, ?, ?)',
[userId, userId, name.trim(), category || null, JSON.stringify(tags), notes || '', isPublicVal]
```

### 前端修改

**文件：** `frontend/pages/index.html`

在添加餐厅表单备注字段后、保存按钮前，新增：

```html
<div class="form-group" id="add-contribute-group" style="display:none">
  <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px">
    <input type="checkbox" id="add-contribute-public" style="width:16px;height:16px;cursor:pointer" />
    贡献至公共池
    <span style="color:#aaa;font-size:12px">（其他用户也可见此餐厅）</span>
  </label>
</div>
```

**文件：** `frontend/scripts/restaurants.js`

1. `initTagChips()` 或 `DOMContentLoaded` 中：检测登录状态，控制 `#add-contribute-group` 显示
2. `submitAddRestaurant()` 中：读取 `#add-contribute-public` 的值，加入 POST body
3. `clearAddForm()` 中：重置复选框为 unchecked

---

## 任务清单

- [ ] 修改 `backend/src/controllers/restaurantsController.js` — createRestaurant 支持 contributeToPublic
- [ ] 修改 `frontend/pages/index.html` — 添加"贡献至公共池"复选框
- [ ] 修改 `frontend/scripts/restaurants.js` — 读取复选框值、传参、清空、登录状态控制
- [ ] 新增单元测试：`backend/tests/integration/restaurants.test.js` 中补充 contributeToPublic 测试用例
- [ ] 更新 `sprint-status.yaml`：`9-5-contribute-to-public-pool: in-progress`

---

## 依赖关系

| 依赖 | 原因 |
|------|------|
| Story 9.1 | is_public 字段已存在 |
| Story 8.4 | JWT 认证中间件，req.userId 可用 |
| Story 9.3 | 添加的公共餐厅会出现在 GET /api/restaurants 合并列表中 |
