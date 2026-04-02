# Story 9.1: DB 迁移 — restaurants 表增加 `is_public` 字段 + `owner_user_id` 可空

## Story Info

| 字段 | 值 |
|------|----|
| Story ID | 9.1 |
| Story Key | `9-1-public-restaurant-db-migration` |
| Epic | Epic 9: 公共餐厅池 |
| Sprint | Sprint 5 |
| Status | ready-for-dev |
| Created | 2026-04-02 |
| Depends on | Epic 8 全部（users 表已含认证字段），Story 1.2（init.js migration 基础结构） |

---

## User Story

**作为** 平台管理员 / 开发者，
**我希望** restaurants 表支持 `is_public` 和 `owner_user_id` 字段，
**以便** 区分公共餐厅与个人私有餐厅，为公共餐厅池功能提供数据基础。

---

## 验收标准（Acceptance Criteria）

### AC-1: 新字段存在
- [ ] `restaurants.is_public` 字段存在：`TINYINT(1) NOT NULL DEFAULT 0`
- [ ] `restaurants.owner_user_id` 字段存在：`INT UNSIGNED NULL`
- [ ] 所有现有餐厅 `is_public=0`，`owner_user_id` = 原 `user_id` 值（向后兼容迁移）

### AC-2: 幂等性
- [ ] 迁移脚本可重复执行（字段已存在时跳过，不报错）
- [ ] 不破坏任何现有数据

### AC-3: 公共餐厅约束语义
- [ ] `is_public=1` 且 `owner_user_id=NULL` 表示平台公共餐厅
- [ ] `is_public=0` 且 `owner_user_id=<user_id>` 表示个人私有餐厅

### AC-4: 种子脚本（可选前置）
- [ ] 提供种子脚本或在迁移脚本中注释示例，可预置 ≥ 10 家公共餐厅（Story 9.6 实现，此处仅搭建字段基础）

---

## 技术实现笔记

### 迁移文件
- 路径：`backend/migrations/add-public-restaurant-fields.js`
- 风格：参照 `add-auth-fields.js`，使用 `INFORMATION_SCHEMA.COLUMNS` 检测字段是否存在

### 字段定义
```sql
-- 新增字段
ALTER TABLE restaurants ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0=个人餐厅, 1=公共餐厅池';
ALTER TABLE restaurants ADD COLUMN owner_user_id INT UNSIGNED NULL COMMENT '公共餐厅为 NULL，个人餐厅为所有者 user_id';

-- 向后兼容：将现有餐厅的 user_id 复制到 owner_user_id
UPDATE restaurants SET owner_user_id = user_id WHERE owner_user_id IS NULL;
```

### 关键规则
- `user_id` 列**保留不变**（向后兼容，现有代码无需修改）
- 新业务逻辑使用 `owner_user_id` 判断所有权
- 索引：`owner_user_id` 加索引提升查询性能

---

## 任务清单

- [ ] 创建 `backend/migrations/add-public-restaurant-fields.js`
- [ ] 脚本中实现幂等检测（字段已存在则跳过）
- [ ] 新增字段 `is_public`
- [ ] 新增字段 `owner_user_id`（可空）
- [ ] 向后兼容：UPDATE 现有行 `owner_user_id = user_id`
- [ ] 为 `owner_user_id` 添加索引
- [ ] 在 `backend/migrations/` 的 README 或注释中说明脚本执行顺序
- [ ] 更新 sprint-status.yaml：`9-1-public-restaurant-db-migration: in-progress`

---

## 依赖关系

| 依赖 | 原因 |
|------|------|
| Story 1.2（init.js） | 基础 restaurants 表结构来源 |
| Story 8.1（add-auth-fields.js） | 迁移脚本命名与结构风格参照 |
| Story 9.2 | 本 Story 完成后，9.2 才能基于 is_public 实现公共餐厅读取 API |
