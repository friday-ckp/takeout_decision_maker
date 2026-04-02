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

async function indexExists(conn, table, indexName) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [dbName, table, indexName]
  );
  return rows[0].cnt > 0;
}

async function migrate() {
  let conn;
  try {
    conn = await mysql.createConnection(config);
    console.log('[Migrate:public-restaurant] 数据库连接成功');

    // ── restaurants 表：新增 is_public 字段 ──────────────────────────
    if (!await columnExists(conn, 'restaurants', 'is_public')) {
      await conn.query(
        `ALTER TABLE restaurants
         ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 0
         COMMENT '0=个人餐厅, 1=公共餐厅池'`
      );
      console.log('[Migrate:public-restaurant] restaurants.is_public 添加成功');
    } else {
      console.log('[Migrate:public-restaurant] restaurants.is_public 已存在，跳过');
    }

    // ── restaurants 表：新增 owner_user_id 可空字段 ──────────────────
    if (!await columnExists(conn, 'restaurants', 'owner_user_id')) {
      await conn.query(
        `ALTER TABLE restaurants
         ADD COLUMN owner_user_id INT UNSIGNED NULL
         COMMENT '公共餐厅为 NULL，个人餐厅为所有者 user_id'`
      );
      console.log('[Migrate:public-restaurant] restaurants.owner_user_id 添加成功');

      // 向后兼容：将现有餐厅的 user_id 回填到 owner_user_id
      // 先确认 user_id 列存在，再包事务执行 DML，避免半迁移状态
      if (await columnExists(conn, 'restaurants', 'user_id')) {
        await conn.beginTransaction();
        try {
          const [result] = await conn.query(
            `UPDATE restaurants SET owner_user_id = user_id
             WHERE owner_user_id IS NULL AND user_id IS NOT NULL`
          );
          await conn.commit();
          console.log(`[Migrate:public-restaurant] 现有 ${result.affectedRows} 条餐厅记录已回填 owner_user_id`);
        } catch (e) {
          await conn.rollback();
          throw e;
        }
      } else {
        console.warn('[Migrate:public-restaurant] restaurants.user_id 不存在，跳过回填，请手动核查数据');
      }
    } else {
      console.log('[Migrate:public-restaurant] restaurants.owner_user_id 已存在，跳过');
    }

    // ── restaurants 表：为 owner_user_id 添加索引 ────────────────────
    if (!await indexExists(conn, 'restaurants', 'idx_owner_user_id')) {
      await conn.query(
        `ALTER TABLE restaurants
         ADD INDEX idx_owner_user_id (owner_user_id)`
      );
      console.log('[Migrate:public-restaurant] idx_owner_user_id 索引添加成功');
    } else {
      console.log('[Migrate:public-restaurant] idx_owner_user_id 索引已存在，跳过');
    }

    // ── restaurants 表：为 is_public 添加索引 ───────────────────────
    if (!await indexExists(conn, 'restaurants', 'idx_is_public')) {
      await conn.query(
        `ALTER TABLE restaurants
         ADD INDEX idx_is_public (is_public)`
      );
      console.log('[Migrate:public-restaurant] idx_is_public 索引添加成功');
    } else {
      console.log('[Migrate:public-restaurant] idx_is_public 索引已存在，跳过');
    }

    console.log('[Migrate:public-restaurant] ✅ 公共餐厅字段迁移完成');
  } catch (err) {
    console.error('[Migrate:public-restaurant] ❌ 迁移失败：', err);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

migrate();
