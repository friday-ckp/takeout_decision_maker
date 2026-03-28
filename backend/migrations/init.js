require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

const config = {
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'takeout_decision',
  multipleStatements: true,
};
if (process.env.DB_SOCKET) {
  config.socketPath = process.env.DB_SOCKET;
} else {
  config.host = process.env.DB_HOST || '127.0.0.1';
  config.port = parseInt(process.env.DB_PORT || '3306', 10);
}

const DDL = `
-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL DEFAULT '默认用户',
  is_temp     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME     NULL COMMENT '临时用户过期时间，7天后惰性清理'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 餐厅表
CREATE TABLE IF NOT EXISTS restaurants (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  name        VARCHAR(100) NOT NULL,
  category    VARCHAR(50)  NULL,
  tags        VARCHAR(255) NULL COMMENT '口味标签，JSON数组字符串',
  notes       TEXT         NULL,
  is_deleted  TINYINT(1)   NOT NULL DEFAULT 0,
  deleted_at  DATETIME     NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 用户-餐厅关系表（收藏/拉黑）
CREATE TABLE IF NOT EXISTS user_restaurant_relations (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  restaurant_id INT UNSIGNED NOT NULL,
  relation_type ENUM('favorite', 'blocked') NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_restaurant (user_id, restaurant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 决策历史表
CREATE TABLE IF NOT EXISTS decision_history (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NOT NULL,
  restaurant_id   INT UNSIGNED NULL COMMENT '餐厅删除后可为空',
  restaurant_name VARCHAR(100) NOT NULL COMMENT '记录快照名称',
  mode            ENUM('wheel', 'minesweeper', 'roulette') NOT NULL,
  decided_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 每日配置表（心情/口味/重玩次数）
CREATE TABLE IF NOT EXISTS daily_config (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      INT UNSIGNED NOT NULL,
  date         DATE         NOT NULL,
  mood         VARCHAR(20)  NULL,
  flavor_tags  VARCHAR(255) NULL COMMENT '口味偏好，JSON数组字符串',
  replay_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_date (user_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 全局设置表
CREATE TABLE IF NOT EXISTS settings (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  \`key\`      VARCHAR(50)  NOT NULL,
  value      VARCHAR(255) NOT NULL,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_key (user_id, \`key\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 多人决策会话表
CREATE TABLE IF NOT EXISTS decision_sessions (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  host_user_id       INT UNSIGNED NOT NULL,
  share_token        VARCHAR(64)  NOT NULL UNIQUE,
  mode               ENUM('wheel', 'minesweeper') NOT NULL DEFAULT 'wheel',
  candidate_snapshot TEXT         NULL COMMENT '展开后权重数组，JSON格式',
  status             ENUM('waiting', 'deciding', 'deciding_locked', 'done', 'expired') NOT NULL DEFAULT 'waiting',
  expires_at         DATETIME     NOT NULL,
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 多人会话参与者表
CREATE TABLE IF NOT EXISTS session_participants (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id   INT UNSIGNED NOT NULL,
  user_id      INT UNSIGNED NOT NULL,
  nickname     VARCHAR(50)  NOT NULL,
  role         ENUM('host', 'guest') NOT NULL DEFAULT 'guest',
  joined_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

const DEFAULT_USER = `
INSERT IGNORE INTO users (id, name, is_temp) VALUES (1, '默认用户', 0);
`;

const DEFAULT_SETTINGS = `
INSERT IGNORE INTO settings (user_id, \`key\`, value) VALUES
  (1, 'daily_replay_limit', '3'),
  (1, 'history_exclude_days', '3');
`;

async function migrate() {
  let conn;
  try {
    conn = await mysql.createConnection(config);
    console.log('[Migrate] 数据库连接成功');

    await conn.query(DDL);
    console.log('[Migrate] 8张表创建/确认完成');

    await conn.query(DEFAULT_USER);
    console.log('[Migrate] 默认用户（id=1）初始化完成');

    await conn.query(DEFAULT_SETTINGS);
    console.log('[Migrate] 默认设置初始化完成');

    console.log('[Migrate] ✅ 数据库初始化完成');
  } catch (err) {
    console.error('[Migrate] ❌ 初始化失败：', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

migrate();
