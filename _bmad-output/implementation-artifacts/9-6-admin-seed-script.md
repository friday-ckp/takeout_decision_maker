# Story 9.6: 管理员种子脚本：预置常见餐厅至公共池

## Story Info

| 字段 | 值 |
|------|----|
| Story ID | 9.6 |
| Story Key | `9-6-admin-seed-script` |
| Epic | Epic 9: 公共餐厅池 |
| Sprint | Sprint 5 |
| Status | ready-for-dev |
| Created | 2026-04-02 |
| Depends on | Story 9.1（restaurants 表 `is_public` + `owner_user_id` 字段） |

---

## User Story

**作为** 平台管理员，
**我希望** 运行一个种子脚本向公共池预置 ≥10 家常见餐厅，
**以便** 新注册用户打开应用时不再面对空列表，降低冷启动门槛。

---

## 验收标准（Acceptance Criteria）

### AC-1: 种子数据写入
- [ ] 执行 `node backend/migrations/seed-public-restaurants.js` 后，数据库 `restaurants` 表中存在 ≥10 条 `is_public=1`、`owner_user_id=NULL`、`user_id=0` 的记录

### AC-2: 幂等性（可重复执行）
- [ ] 重复执行脚本不会产生重复数据（使用 `INSERT IGNORE` + 联合唯一约束，或先查后插）

### AC-3: 数据完整性
- [ ] 每条公共餐厅包含：`name`（必填）、`category`（非空）、`tags`（JSON 数组字符串），`notes` 可选
- [ ] 预置餐厅涵盖至少 5 个不同品类（如：中餐/快餐/日料/火锅/西餐）

### AC-4: 依赖字段检查
- [ ] 脚本在写入前检查 `is_public` 字段是否存在；若不存在则打印提示并退出（要求先运行 Story 9.1 迁移）

### AC-5: 日志输出
- [ ] 脚本运行时打印每条插入/跳过的记录，并在结束时汇报：新增 N 条、跳过 N 条（已存在）

---

## 技术规范

### 新增文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/migrations/seed-public-restaurants.js` | **新增** | 公共餐厅种子脚本 |

### 关键设计决策

- **`user_id = 0`**：系统/平台维护的餐厅使用哨兵值 0（无 FK 约束），区别于真实用户
- **`owner_user_id = NULL`**：表示平台维护，非个人贡献
- **`is_public = 1`**：标记为公共池
- **幂等性实现**：按 `(name, user_id)` 判重，已存在则跳过（`SELECT COUNT` 方式，避免索引依赖）
- **连接方式**：使用独立连接（非 pool），`multipleStatements: false`

### 预置餐厅数据（≥10 条）

| name | category | tags | notes |
|------|----------|------|-------|
| 兰州拉面 | 中餐 | `["重口","咸"]` | 经典西北风味 |
| 黄焖鸡米饭 | 中餐 | `["重口","咸"]` | 经典家常菜 |
| 麻辣烫 | 中餐 | `["重口","辣"]` | 自选食材 |
| 麦当劳 | 快餐 | `["随意"]` | 汉堡薯条 |
| 肯德基 | 快餐 | `["随意"]` | 炸鸡汉堡 |
| 沙县小吃 | 中餐 | `["清淡","咸"]` | 实惠家常 |
| 寿司 | 日料 | `["清淡","甜"]` | 新鲜海鲜 |
| 牛肉火锅 | 火锅 | `["重口","辣"]` | 暖胃选择 |
| 披萨 | 西餐 | `["随意"]` | 多种口味 |
| 酸辣粉 | 中餐 | `["重口","酸辣"]` | 街头小吃 |
| 烤鸭 | 中餐 | `["咸"]` | 北京特色 |
| 泡面（自热） | 快餐 | `["随意"]` | 快捷简餐 |

---

## Dev Notes

- 新增文件：`backend/migrations/seed-public-restaurants.js`
- 系统餐厅使用 `user_id=0` 哨兵值，无需修改 users 表
- 幂等性通过 `SELECT COUNT` 判重实现，不依赖唯一索引
- `is_public` / `owner_user_id` 字段由 Story 9.1 迁移（add-public-pool.js）创建
- 脚本运行前自动检查依赖字段，缺失时给出明确提示

---

## Status

- [x] Story 创建（ready-for-dev）
- [x] 开发中（in-progress）
- [ ] 代码审查（review）
- [ ] 完成（done）
