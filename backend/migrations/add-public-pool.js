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
    console.log('[Migrate:public-pool] 数据库连接成功');

    // Story 9.1: restaurants 表新增 is_public 字段
    if (!await columnExists(conn, 'restaurants', 'is_public')) {
      await conn.query(
        `ALTER TABLE restaurants
         ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 0
         COMMENT '1=公共餐厅池，所有用户可见；0=私有（默认）'
         AFTER notes`
      );
      console.log('[Migrate:public-pool] restaurants.is_public 添加成功');
    } else {
      console.log('[Migrate:public-pool] restaurants.is_public 已存在，跳过');
    }

    // Story 9.1: restaurants 表新增 owner_user_id 字段（可空，NULL 表示平台维护）
    if (!await columnExists(conn, 'restaurants', 'owner_user_id')) {
      await conn.query(
        `ALTER TABLE restaurants
         ADD COLUMN owner_user_id INT UNSIGNED NULL DEFAULT NULL
         COMMENT '公共餐厅的贡献者 user_id；NULL 表示平台维护的系统餐厅'
         AFTER is_public`
      );
      console.log('[Migrate:public-pool] restaurants.owner_user_id 添加成功');
    } else {
      console.log('[Migrate:public-pool] restaurants.owner_user_id 已存在，跳过');
    }

    // 添加查询优化索引
    await conn.query(
      `CREATE INDEX IF NOT EXISTS idx_restaurants_user_deleted
       ON restaurants (user_id, is_deleted)`
    ).catch(() => conn.query(
      `ALTER TABLE restaurants ADD INDEX idx_restaurants_user_deleted (user_id, is_deleted)`
    ).catch(() => console.log('[Migrate:public-pool] idx_restaurants_user_deleted 已存在，跳过')));

    await conn.query(
      `CREATE INDEX IF NOT EXISTS idx_restaurants_public_deleted
       ON restaurants (is_public, is_deleted)`
    ).catch(() => conn.query(
      `ALTER TABLE restaurants ADD INDEX idx_restaurants_public_deleted (is_public, is_deleted)`
    ).catch(() => console.log('[Migrate:public-pool] idx_restaurants_public_deleted 已存在，跳过')));

    console.log('[Migrate:public-pool] ✅ 公共餐厅池字段迁移完成');
  } catch (err) {
    console.error('[Migrate:public-pool] ❌ 迁移失败：', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

migrate();
