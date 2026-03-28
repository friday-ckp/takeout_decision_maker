const mysql = require('mysql2/promise');

const poolConfig = {
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'takeout_decision',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// 支持 Unix socket 连接（沙箱环境）
if (process.env.DB_SOCKET) {
  poolConfig.socketPath = process.env.DB_SOCKET;
} else {
  poolConfig.host = process.env.DB_HOST || '127.0.0.1';
  poolConfig.port = parseInt(process.env.DB_PORT || '3306', 10);
}

const pool = mysql.createPool(poolConfig);

async function testConnection() {
  const conn = await pool.getConnection();
  conn.release();
}

module.exports = { pool, testConnection };
