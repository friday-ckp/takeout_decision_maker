// Story 9.6: 管理员种子脚本 - 预置常见餐厅至公共池
// 用途：初始化平台公共餐厅数据，供所有用户使用
// 执行：node backend/migrations/seed-public-restaurants.js
// 幂等：可重复执行，已存在的餐厅（按 name + user_id 判重）会自动跳过

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

// ── 公共餐厅种子数据 ─────────────────────────────────────
// user_id=0：平台哨兵值（非真实用户），表示系统维护的公共餐厅
// is_public=1：公共池，所有用户可见
// owner_user_id=NULL：平台维护，非个人贡献
const PUBLIC_RESTAURANTS = [
  { name: '兰州拉面',     category: '中餐', tags: ['重口', '咸'],     notes: '经典西北风味' },
  { name: '黄焖鸡米饭',   category: '中餐', tags: ['重口', '咸'],     notes: '经典家常菜' },
  { name: '麻辣烫',       category: '中餐', tags: ['重口', '辣'],     notes: '自选食材，口味可调' },
  { name: '沙县小吃',     category: '中餐', tags: ['清淡', '咸'],     notes: '实惠家常，蒸饺拌面' },
  { name: '酸辣粉',       category: '中餐', tags: ['重口', '酸辣'],   notes: '街头小吃，酸辣开胃' },
  { name: '烤鸭',         category: '中餐', tags: ['咸'],             notes: '北京特色，脆皮鸭肉' },
  { name: '麦当劳',       category: '快餐', tags: ['随意'],           notes: '汉堡薯条，经典西式快餐' },
  { name: '肯德基',       category: '快餐', tags: ['随意'],           notes: '炸鸡汉堡，全家欢' },
  { name: '寿司',         category: '日料', tags: ['清淡', '甜'],     notes: '新鲜海鲜，日式清淡' },
  { name: '牛肉火锅',     category: '火锅', tags: ['重口', '辣'],     notes: '暖胃选择，涮肉涮菜' },
  { name: '披萨',         category: '西餐', tags: ['随意'],           notes: '多种口味，芝士拉丝' },
  { name: '泡面（自热）', category: '快餐', tags: ['随意'],           notes: '快捷简餐，省时方便' },
];

// ── 辅助：检查字段是否存在 ───────────────────────────────
async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [dbName, table, column]
  );
  return rows[0].cnt > 0;
}

// ── 辅助：检查餐厅是否已存在（按 name + user_id 判重）────
async function restaurantExists(conn, name, userId) {
  const [rows] = await conn.query(
    'SELECT COUNT(*) AS cnt FROM restaurants WHERE name = ? AND user_id = ?',
    [name, userId]
  );
  return rows[0].cnt > 0;
}

// ── 主函数 ───────────────────────────────────────────────
async function seed() {
  let conn;
  let insertedCount = 0;
  let skippedCount = 0;

  try {
    conn = await mysql.createConnection(config);
    console.log('[Seed:public-restaurants] 数据库连接成功');

    // AC-4: 依赖字段检查
    const hasIsPublic = await columnExists(conn, 'restaurants', 'is_public');
    if (!hasIsPublic) {
      console.error(
        '[Seed:public-restaurants] ❌ 缺少 is_public 字段，请先执行 Story 9.1 迁移：\n' +
        '  node backend/migrations/add-public-pool.js'
      );
      process.exit(1);
    }

    const hasOwnerUserId = await columnExists(conn, 'restaurants', 'owner_user_id');
    if (!hasOwnerUserId) {
      console.error(
        '[Seed:public-restaurants] ❌ 缺少 owner_user_id 字段，请先执行 Story 9.1 迁移：\n' +
        '  node backend/migrations/add-public-pool.js'
      );
      process.exit(1);
    }

    console.log('[Seed:public-restaurants] 依赖字段检查通过，开始写入种子数据...');

    // AC-2: 逐条判重插入（幂等）
    for (const r of PUBLIC_RESTAURANTS) {
      const exists = await restaurantExists(conn, r.name, 0);
      if (exists) {
        console.log(`  [跳过] ${r.name}（已存在）`);
        skippedCount++;
        continue;
      }

      await conn.query(
        `INSERT INTO restaurants
           (user_id, name, category, tags, notes, is_public, owner_user_id, is_deleted)
         VALUES (?, ?, ?, ?, ?, 1, NULL, 0)`,
        [0, r.name, r.category, JSON.stringify(r.tags), r.notes || null]
      );
      console.log(`  [新增] ${r.name}（${r.category}）`);
      insertedCount++;
    }

    console.log(
      `\n[Seed:public-restaurants] ✅ 完成：新增 ${insertedCount} 条，跳过 ${skippedCount} 条（已存在）`
    );
  } catch (err) {
    console.error('[Seed:public-restaurants] ❌ 执行失败：', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

seed();
