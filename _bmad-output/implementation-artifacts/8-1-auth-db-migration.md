# Story 8.1: 数据库迁移 — 用户认证字段

## Story Info

| 字段 | 值 |
|------|----|
| Story ID | 8.1 |
| Story Key | `8-1-auth-db-migration` |
| Epic | Epic 8: 用户注册与登录 |
| Sprint | Sprint 4 |
| Status | ready-for-dev |
| Created | 2026-03-30 |

---

## User Story

**作为** 系统管理员，
**我希望** 执行一个可重复运行的迁移脚本，
**以便** 数据库支持用户邮箱注册、密码认证和多人投票模式。

---

## 背景与业务价值

Epic 8 所有认证功能（注册/登录/JWT中间件）的**前置依赖**。
同时配合 Sprint 4 对多人决策的重设计（去除转盘/扫雷模式，改为投票模式）需要的 Schema 变更。

若此 Story 未完成，Story 8.2（注册API）、8.3（登录API）无法开发。

---

## 验收标准（Acceptance Criteria）

### AC-1: users 表新增认证字段
- [ ] `users.email` 新增：`VARCHAR(100) UNIQUE NULL`
- [ ] `users.password_hash` 新增：`VARCHAR(255) NULL`
- [ ] `users.updated_at` 新增：`DATETIME NULL`
- [ ] 既有记录的新字段值为 NULL（不破坏现有数据）
- [ ] email 字段有唯一约束（但允许 NULL，NULL 不参与唯一性检查）

### AC-2: decision_sessions 表变更
- [ ] 移除 `mode` 列（原为 `ENUM('wheel', 'minesweeper')`）
- [ ] 新增 `deadline_at DATETIME NULL`（发起人设定的截止时间，可为空表示永不过期）

### AC-3: decision_history 表变更
- [ ] `mode` 字段从 `ENUM('wheel', 'minesweeper', 'roulette')` 改为包含 `'vote'`：
  新枚举：`ENUM('wheel', 'minesweeper', 'roulette', 'vote')`

### AC-4: 幂等性（可重复执行）
- [ ] 脚本重复执行不报错，不破坏已有数据
- [ ] 利用 `INFORMATION_SCHEMA.COLUMNS` 检查列是否存在再 ALTER
- [ ] `DROP COLUMN mode` 前先检查列是否存在

### AC-5: 环境变量补充
- [ ] `backend/.env.example` 新增 `JWT_SECRET=your-secret-key-here`

### AC-6: package.json 脚本
- [ ] `package.json` 的 `scripts` 新增：`"migrate:auth": "node migrations/add-auth-fields.js"`

---

## 技术规范

### 文件路径

| 文件 | 操作 |
|------|------|
| `backend/migrations/add-auth-fields.js` | **新建**（迁移脚本主体） |
| `backend/.env.example` | **修改**（新增 JWT_SECRET 行） |
| `backend/package.json` | **修改**（新增 migrate:auth 脚本） |

> ⚠️ 不要修改 `backend/migrations/init.js`，保持初始化脚本独立性。

### 当前数据库 Schema（迁移前参考）

**users 表（init.js 中定义）：**
```sql
CREATE TABLE IF NOT EXISTS users (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL DEFAULT '默认用户',
  is_temp     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME     NULL COMMENT '临时用户过期时间，7天后惰性清理'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**decision_sessions 表（init.js 中定义）：**
```sql
CREATE TABLE IF NOT EXISTS decision_sessions (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  host_user_id       INT UNSIGNED NOT NULL,
  share_token        VARCHAR(64)  NOT NULL UNIQUE,
  mode               ENUM('wheel', 'minesweeper') NOT NULL DEFAULT 'wheel',  -- 本次迁移要移除
  candidate_snapshot TEXT         NULL,
  status             ENUM('waiting', 'deciding', 'deciding_locked', 'done', 'expired') NOT NULL DEFAULT 'waiting',
  expires_at         DATETIME     NOT NULL,
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**decision_history 表（init.js 中定义）：**
```sql
CREATE TABLE IF NOT EXISTS decision_history (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NOT NULL,
  restaurant_id   INT UNSIGNED NULL,
  restaurant_name VARCHAR(100) NOT NULL,
  mode            ENUM('wheel', 'minesweeper', 'roulette') NOT NULL,  -- 本次迁移要新增 'vote'
  decided_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 迁移脚本结构（参考 init.js 实现风格）

```js
// backend/migrations/add-auth-fields.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

// 1. 复用 init.js 同样的连接配置结构（DB_SOCKET / DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME）
// 2. async function migrate() { ... try/catch/finally }
// 3. 每个 ALTER 操作前先检查列是否存在（INFORMATION_SCHEMA.COLUMNS）
// 4. 每个操作独立 try/catch，失败时 console.error 并继续（或 process.exit(1) 视严重性）
```

### 幂等性检查示例（必须遵循）

```js
// 检查列是否存在的辅助函数
async function columnExists(conn, table, column, dbName) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [dbName, table, column]
  );
  return rows[0].cnt > 0;
}

// 使用示例：
if (!await columnExists(conn, 'users', 'email', dbName)) {
  await conn.query('ALTER TABLE users ADD COLUMN email VARCHAR(100) UNIQUE NULL');
  console.log('[Migrate] users.email 添加成功');
} else {
  console.log('[Migrate] users.email 已存在，跳过');
}
```

### mode ENUM 修改（MODIFY COLUMN）

ENUM 修改使用 MODIFY COLUMN，MySQL 会保留现有数据中合法的枚举值：

```sql
ALTER TABLE decision_history
MODIFY COLUMN mode ENUM('wheel', 'minesweeper', 'roulette', 'vote') NOT NULL;
```

> MODIFY COLUMN 天然幂等（重复执行不报错），无需 INFORMATION_SCHEMA 检查。

### DROP COLUMN 的幂等检查

```js
if (await columnExists(conn, 'decision_sessions', 'mode', dbName)) {
  await conn.query('ALTER TABLE decision_sessions DROP COLUMN mode');
  console.log('[Migrate] decision_sessions.mode 删除成功');
} else {
  console.log('[Migrate] decision_sessions.mode 已不存在，跳过');
}
```

---

## 依赖关系

| 依赖 | 说明 |
|------|------|
| `mysql2` | 已在 package.json 中，无需新增 |
| `dotenv` | 已在 package.json 中，无需新增 |
| DB 已通过 `npm run migrate` 初始化 | 需先执行 init.js |

> ⚠️ `jsonwebtoken` 和 `bcryptjs` 依赖将在 Story 8.2 中添加（注册API需要），本 Story 不需要。

---

## 环境变量

`backend/.env.example` 在现有内容末尾新增：

```
# JWT 认证（Story 8.4）
JWT_SECRET=your-secret-key-here
```

---

## 测试要求

本 Story 为纯数据库迁移，不需要单元测试文件。
验收方式：手动执行迁移脚本，通过以下命令验证：

```bash
# 第一次执行
node migrations/add-auth-fields.js

# 第二次执行（验证幂等性）
node migrations/add-auth-fields.js

# 验证字段存在（MySQL CLI）
DESCRIBE users;
DESCRIBE decision_sessions;
SHOW COLUMNS FROM decision_history LIKE 'mode';
```

期望输出（每次执行）：
- 全部显示"添加成功"或"已存在，跳过"
- 无任何 ERROR 或 process.exit(1)

---

## 开发注意事项

1. **不要修改 init.js** — 保持初始化脚本独立，add-auth-fields.js 仅做增量变更
2. **DB_NAME 获取方式** — 从 `process.env.DB_NAME || 'takeout_decision'` 获取，用于 INFORMATION_SCHEMA 查询
3. **NULL vs NOT NULL** — email 和 password_hash 必须为 NULL，因为 is_temp=true 的临时用户不需要这些字段
4. **updated_at 不加 ON UPDATE** — 与 init.js 中 restaurants.updated_at 不同，users.updated_at 通过应用层手动更新
5. **连接配置复用** — 完全照抄 init.js 头部的 config 对象和 socket 判断逻辑

---

## 完成后下一步

Story 8.1 完成后，可进入：
- **Story 8.2**（注册API）— 需要 users.email 和 users.password_hash
- 两个 Story 无强制依赖关系外，均依赖本 Story 的 DB 迁移

---

## Dev Notes（开发完成后填写）

> （完成后由开发人员填写：遇到的问题、实际做法与Story的差异、需要传递给下一个Story的信息）

---

## Status

- [x] Story 创建（ready-for-dev）
- [ ] 开发中（in-progress）
- [ ] 代码审查（review）
- [ ] 完成（done）
