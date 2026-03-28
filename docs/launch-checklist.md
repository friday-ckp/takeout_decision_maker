# 上线就绪 Checklist

> Story 7.6 | 版本 1.0 | 2026-03-28
> 每次正式上线前逐项核查，全部通过后方可发布

---

## 一、安全性

- [ ] `.env` 未提交到 git（`git status` 确认）
- [ ] `SESSION_SECRET` 已替换为随机字符串（非默认值 `change_me_to_a_random_string`）
- [ ] `DB_PASSWORD` 已设置为强密码
- [ ] `APP_BASE_URL` 已设置为生产域名（非 localhost）
- [ ] `NODE_ENV=production` 已配置
- [ ] 数据库用户权限最小化（仅授权 `takeout_decision` 库）
- [ ] Nginx 已配置 HTTPS（certbot 证书有效）
- [ ] HTTP 已重定向到 HTTPS

---

## 二、数据库

- [ ] `npm run migrate` 执行成功，所有表已创建
- [ ] 数据库字符集为 `utf8mb4`（支持 Emoji）
- [ ] 数据库连接池配置合理（默认 10 连接）
- [ ] 已安排定期数据库备份（建议每日一次）

---

## 三、后端服务

- [ ] `npm start` 或 PM2 启动无报错
- [ ] `/health` 接口返回 200
- [ ] `/api/restaurants` 接口返回正确数据结构
- [ ] WebSocket 路径 `/ws/sessions` 可正常连接
- [ ] PM2 已设置开机自启（`pm2 startup && pm2 save`）
- [ ] 日志输出正常（`pm2 logs takeout-decision`）

---

## 四、前端

- [ ] `APP_BASE_URL` 与 Nginx 配置域名一致（分享链接可访问）
- [ ] 首页在 Chrome / Safari 最新版正常加载
- [ ] 首屏 FCP < 2s（DevTools Lighthouse 验证）
- [ ] 375px 宽度下主要页面无横向溢出（Chrome DevTools 模拟）
- [ ] 扫雷翻牌 3D 动画在 Safari 正常显示
- [ ] 转盘 Canvas 绘制无闪烁/错位

---

## 五、核心功能验收

### 单人流程

- [ ] 空状态引导页正常显示
- [ ] 添加餐厅 → 餐厅列表出现
- [ ] 首页选择心情 → 口味偏好 → 进入模式选择
- [ ] 转盘模式：旋转动画 → 结果页 → 再来一次（次数限制）
- [ ] 扫雷模式：点击格子 → 翻牌动画 → 命中/扫雷效果
- [ ] 历史记录页显示决策记录
- [ ] 设置页保存生效（翻盘次数上限）
- [ ] 软删除 → 回收站 → 彻底删除
- [ ] 收藏 / 黑名单功能

### 多人流程

- [ ] 创建多人会话 → 生成分享链接
- [ ] 受邀者通过链接进入 → 昵称输入 → 等待室
- [ ] 等待室实时显示参与者列表（participant_joined 事件）
- [ ] 发起人开始决策 → 所有客户端同步跳转
- [ ] 多人转盘：同步旋转 → 统一结果
- [ ] 多人扫雷：先到先得，其他参与者实时看到已翻牌
- [ ] 结果页确认 → 会话状态更新为 completed
- [ ] WebSocket 断线后 3s 自动重连

---

## 六、性能

- [ ] WebSocket 10 并发压测通过（`node tests/ws-stress.test.js`）
  - P95 延迟 < 500ms
  - 成功率 >= 95%
- [ ] API P95 响应时间 < 200ms（本地网络）
- [ ] 首屏 FCP < 2s

---

## 七、运维就绪

- [ ] `DEPLOY.md` 部署文档已更新
- [ ] 数据库迁移脚本可重复执行（`IF NOT EXISTS`）
- [ ] 日志级别适合生产环境（不输出敏感信息）
- [ ] 监控告警已配置（PM2 / uptimerobot 等）
- [ ] 回滚方案已确认（`git revert` + `pm2 restart`）

---

## 八、上线后验证（发布后 30 分钟内）

- [ ] 正式域名首页可访问
- [ ] 添加一条测试餐厅并成功删除
- [ ] 完成一次转盘决策全流程
- [ ] 创建多人会话并用另一设备加入测试
- [ ] 检查 PM2 日志无异常错误
- [ ] 检查 Nginx access.log 请求正常

---

**签核：** __________ 日期：__________
