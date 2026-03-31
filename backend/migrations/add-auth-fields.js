require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

const dbName = process.env.DB_NAME || 'takeout_decision';

const config = {
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: dbName,
  multipleStatements: false,
};
if (process.env.DB_SOCKET) {
  config.socketPath = process.env.DB_SOCKET;
} else {
  config.host = process.env.DB_HOST || '127.0.0.1';
  config.port = parseInt(process.env.DB_PORT || '3306', 10);
}

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [dbName, table, column]
  );
  return rows[0].cnt > 0;
}

async function migrate() {
  let conn;
  try {
    conn = await mysql.createConnection(config);
    console.log('[Migrate:auth] 数据库连接成功');

    // ── users 表：新增认证字段 ──────────────────────────────────────
    if (!await columnExists(conn, 'users', 'email')) {
      await conn.query('ALTER TABLE users ADD COLUMN email VARCHAR(100) UNIQUE NULL');
      console.log('[Migrate:auth] users.email 添加成功');
    } else {
      console.log('[Migrate:auth] users.email 已存在，跳过');
    }

    if (!await columnExists(conn, 'users', 'password_hash')) {
      await conn.query('ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL');
      console.log('[Migrate:auth] users.password_hash 添加成功');
    } else {
      console.log('[Migrate:auth] users.password_hash 已存在，跳过');
    }

    if (!await columnExists(conn, 'users', 'updated_at')) {
      await conn.query('ALTER TABLE users ADD COLUMN updated_at DATETIME NULL');
      console.log('[Migrate:auth] users.updated_at 添加成功');
    } else {
      console.log('[Migrate:auth] users.updated_at 已存在，跳过');
    }

    // ── decision_sessions 表：移除 mode，新增 deadline_at ───────────
    if (await columnExists(conn, 'decision_sessions', 'mode')) {
      await conn.query('ALTER TABLE decision_sessions DROP COLUMN mode');
      console.log('[Migrate:auth] decision_sessions.mode 删除成功');
    } else {
      console.log('[Migrate:auth] decision_sessions.mode 已不存在，跳过');
    }

    if (!await columnExists(conn, 'decision_sessions', 'deadline_at')) {
      await conn.query('ALTER TABLE decision_sessions ADD COLUMN deadline_at DATETIME NULL COMMENT \'发起人设定的投票截止时间，NULL 表示永不过期\'');
      console.log('[Migrate:auth] decision_sessions.deadline_at 添加成功');
    } else {
      console.log('[Migrate:auth] decision_sessions.deadline_at 已存在，跳过');
    }

    // ── decision_history 表：mode ENUM 新增 vote ───────────────────
    await conn.query(
      `ALTER TABLE decision_history
       MODIFY COLUMN mode ENUM('wheel', 'minesweeper', 'roulette', 'vote') NOT NULL`
    );
    console.log('[Migrate:auth] decision_history.mode ENUM 更新成功（新增 vote）');

    console.log('[Migrate:auth] ✅ 认证字段迁移完成');
  } catch (err) {
    console.error('[Migrate:auth] ❌ 迁移失败：', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

migrate();
