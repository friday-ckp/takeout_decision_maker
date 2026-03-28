# 外卖点餐决策器 — 部署文档

> Story 7.6 | 版本 1.0 | 2026-03-28

---

## 系统要求

| 组件 | 最低版本 | 推荐版本 |
|------|----------|----------|
| Node.js | 18.x | 20.x LTS |
| MySQL | 8.0 | 8.0+ |
| Nginx | 1.20+ | 最新稳定版 |
| 操作系统 | Ubuntu 20.04+ | Ubuntu 22.04 LTS |
| 内存 | 512MB | 1GB+ |
| 磁盘 | 2GB | 10GB+ |

---

## 快速部署（单机 / VPS）

### 第一步：克隆代码

```bash
git clone <your-repo-url> /opt/takeout-decision
cd /opt/takeout-decision/takeout_decision_maker/backend
```

### 第二步：安装依赖

```bash
npm install --production
```

### 第三步：配置环境变量

```bash
cp .env.example .env
nano .env
```

必填配置项：

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=takeout_user
DB_PASSWORD=your_strong_password
DB_NAME=takeout_decision
PORT=3000
NODE_ENV=production
SESSION_SECRET=请替换为32位随机字符串
SESSION_EXPIRE_HOURS=24
APP_BASE_URL=https://your-domain.com
```

生成随机 SESSION_SECRET：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 第四步：创建数据库

```bash
# 以 root 身份登录 MySQL
mysql -u root -p

# 执行以下 SQL
CREATE DATABASE takeout_decision CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'takeout_user'@'localhost' IDENTIFIED BY 'your_strong_password';
GRANT ALL PRIVILEGES ON takeout_decision.* TO 'takeout_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 第五步：运行数据库迁移

```bash
npm run migrate
```

验证迁移结果：

```bash
mysql -u takeout_user -p takeout_decision -e "SHOW TABLES;"
```

预期输出：

```
restaurants
daily_config
decision_history
decision_sessions
session_participants
settings
```

### 第六步：使用 PM2 管理进程

```bash
npm install -g pm2

# 启动服务
pm2 start src/index.js --name takeout-decision

# 开机自启
pm2 startup
pm2 save
```

常用 PM2 命令：

```bash
pm2 status              # 查看状态
pm2 logs takeout-decision  # 查看日志
pm2 restart takeout-decision  # 重启
pm2 stop takeout-decision     # 停止
```

### 第七步：配置 Nginx 反向代理

```bash
# 创建 Nginx 配置
cat > /etc/nginx/sites-available/takeout-decision << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /opt/takeout-decision/takeout_decision_maker/frontend;
        index pages/index.html;
        try_files $uri $uri/ /pages/index.html;
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket 反向代理（关键：需要升级协议）
    location /ws/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
EOF

# 启用配置
ln -s /etc/nginx/sites-available/takeout-decision /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 第八步：配置 HTTPS（推荐）

```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

---

## 环境变量完整说明

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `DB_HOST` | ✅ | 127.0.0.1 | MySQL 主机地址 |
| `DB_PORT` | 否 | 3306 | MySQL 端口 |
| `DB_USER` | ✅ | root | 数据库用户名 |
| `DB_PASSWORD` | ✅ | — | 数据库密码 |
| `DB_NAME` | ✅ | takeout_decision | 数据库名 |
| `PORT` | 否 | 3000 | 后端监听端口 |
| `NODE_ENV` | 否 | development | `development` 或 `production` |
| `SESSION_SECRET` | ✅ | — | 会话签名密钥（生产必须修改） |
| `SESSION_EXPIRE_HOURS` | 否 | 24 | 多人会话有效期（小时） |
| `APP_BASE_URL` | ✅ | http://localhost:3000 | 外部访问地址（用于生成分享链接） |

---

## 验证部署

```bash
# 1. 健康检查
curl http://localhost:3000/health

# 2. 获取餐厅列表
curl http://localhost:3000/api/restaurants

# 3. 检查 WebSocket（需要 wscat）
npx wscat -c "ws://localhost:3000/ws/sessions?token=test"
```

---

## WebSocket 压测

```bash
# 在 backend 目录下运行
node tests/ws-stress.test.js --clients=10 --host=localhost --port=3000
```

预期结果：
- P95 延迟 < 500ms
- 成功率 >= 95%

---

## 常见问题

### 数据库连接失败

```
[Server] ⚠️  数据库未连接
```

检查步骤：
1. `mysql -u takeout_user -p takeout_decision` — 验证数据库凭据
2. `cat .env | grep DB_` — 确认 .env 配置正确
3. `systemctl status mysql` — 确认 MySQL 服务运行中

### WebSocket 连接被拒绝（通过 Nginx）

确认 Nginx 配置中包含：
```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

### 分享链接指向 localhost

修改 `.env` 中的 `APP_BASE_URL` 为实际域名：
```env
APP_BASE_URL=https://your-domain.com
```

### 软删除数据未自动清理

软删除采用惰性清理，下次 API 调用时触发。如需手动清理 7 天前已删除的餐厅：

```sql
DELETE FROM restaurants
WHERE deleted_at IS NOT NULL
  AND deleted_at < DATE_SUB(NOW(), INTERVAL 7 DAY);
```

---

## 安全注意事项

- `.env` 文件已在 `.gitignore` 中排除，切勿提交到代码库
- 生产环境 `SESSION_SECRET` 必须设置为随机字符串
- 建议数据库用户仅授权目标数据库，不使用 root
- 推荐配置 HTTPS，防止 WebSocket 明文传输
- 定期备份数据库：`mysqldump -u takeout_user -p takeout_decision > backup.sql`

---

## 更新部署

```bash
cd /opt/takeout-decision
git pull origin main
cd takeout_decision_maker/backend
npm install --production
npm run migrate   # 如有新迁移
pm2 restart takeout-decision
```
