/**
 * Story 7.5 — WebSocket 并发压测
 *
 * 测试目标（NFR-03, NFR-04）：
 *   - 10 人并发连接同一会话
 *   - 广播延迟 P95 < 500ms
 *   - 所有客户端均能正常收到广播消息
 *
 * 运行方式：
 *   node tests/ws-stress.test.js
 *   或：
 *   node tests/ws-stress.test.js --clients=10 --host=localhost --port=3000
 */

'use strict';

const http = require('http');
const { WebSocket } = require('ws');

// ────────────────────────────────────────────────────────────────────────
// 配置（可通过命令行参数覆盖）
// ────────────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [k, v] = a.slice(2).split('=');
      return [k, v];
    })
);

const HOST        = args.host    || 'localhost';
const PORT        = parseInt(args.port  || '3000', 10);
const NUM_CLIENTS = parseInt(args.clients || '10', 10);
const LATENCY_P95_LIMIT = 500; // ms

const BASE_URL = `http://${HOST}:${PORT}`;
const WS_BASE  = `ws://${HOST}:${PORT}/ws/sessions`;

// ────────────────────────────────────────────────────────────────────────
// HTTP 辅助
// ────────────────────────────────────────────────────────────────────────
function httpRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: HOST,
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch (e) { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ────────────────────────────────────────────────────────────────────────
// 测试数据准备：创建测试餐厅 + 会话
// ────────────────────────────────────────────────────────────────────────
async function setup() {
  // 1. 添加一个测试餐厅（如果餐厅库为空）
  const listRes = await httpRequest('GET', '/api/restaurants');
  let restaurantId;
  if (listRes.body.data && listRes.body.data.length > 0) {
    restaurantId = listRes.body.data[0].id;
  } else {
    const addRes = await httpRequest('POST', '/api/restaurants', {
      name: '压测测试餐厅',
      cuisine: '中式',
    });
    if (addRes.status !== 201 && addRes.status !== 200) {
      throw new Error(`添加餐厅失败: ${JSON.stringify(addRes.body)}`);
    }
    restaurantId = addRes.body.data.id;
  }

  // 2. 创建多人会话
  const sessionRes = await httpRequest('POST', '/api/sessions', {
    mode: 'wheel',
    nickname: 'StressHost',
  });
  if (sessionRes.status !== 201 && sessionRes.status !== 200) {
    throw new Error(`创建会话失败: ${JSON.stringify(sessionRes.body)}`);
  }
  const session = sessionRes.body.data;
  return { shareToken: session.shareToken || session.share_token, sessionId: session.id };
}

// ────────────────────────────────────────────────────────────────────────
// 连接单个 WebSocket 客户端
// ────────────────────────────────────────────────────────────────────────
function connectClient(token, clientId) {
  return new Promise((resolve, reject) => {
    const url = `${WS_BASE}?token=${token}&nickname=Client${clientId}&userId=${clientId}`;
    const ws = new WebSocket(url);

    const receivedEvents = [];
    const latencies = [];
    let connectedAt = null;

    ws.on('open', () => {
      connectedAt = Date.now();
    });

    ws.on('message', (raw) => {
      const recvTime = Date.now();
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch (_) { return; }
      receivedEvents.push({ event: msg.event, ts: recvTime });
    });

    ws.on('error', reject);

    // 等待 session_state 表示连接就绪
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.event === 'session_state') {
          resolve({ ws, receivedEvents, latencies, connectedAt });
        }
      } catch (_) {}
    });

    // 5s 超时
    setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        reject(new Error(`Client ${clientId} 连接超时`));
      } else {
        resolve({ ws, receivedEvents, latencies, connectedAt });
      }
    }, 5000);
  });
}

// ────────────────────────────────────────────────────────────────────────
// 主压测逻辑
// ────────────────────────────────────────────────────────────────────────
async function runStressTest() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  WebSocket 并发压测 — Story 7.5');
  console.log(`  目标: ${NUM_CLIENTS} 并发连接，广播延迟 P95 < ${LATENCY_P95_LIMIT}ms`);
  console.log(`  服务器: ${BASE_URL}`);
  console.log('═══════════════════════════════════════════════════\n');

  // ── 阶段 0：健康检查 ────────────────────────────────────────────────
  let healthRes;
  try {
    healthRes = await httpRequest('GET', '/health');
  } catch (e) {
    console.error(`❌ 无法连接到服务器 ${BASE_URL}`);
    console.error('   请先启动后端：npm run dev（或 npm start）');
    process.exit(1);
  }
  console.log(`✅ 服务器健康检查: HTTP ${healthRes.status}\n`);

  // ── 阶段 1：准备数据 ────────────────────────────────────────────────
  console.log('[1/4] 准备测试数据...');
  let shareToken;
  try {
    const result = await setup();
    shareToken = result.shareToken;
    console.log(`      会话 token: ${shareToken}\n`);
  } catch (e) {
    console.error(`❌ 数据准备失败: ${e.message}`);
    console.error('   (如需独立运行压测，请先通过 API 创建会话并手动指定 token)');
    process.exit(1);
  }

  // ── 阶段 2：并发建连 ────────────────────────────────────────────────
  console.log(`[2/4] 并发建立 ${NUM_CLIENTS} 个 WebSocket 连接...`);
  const connectStart = Date.now();
  let clients;
  try {
    clients = await Promise.all(
      Array.from({ length: NUM_CLIENTS }, (_, i) => connectClient(shareToken, i + 1))
    );
  } catch (e) {
    console.error(`❌ 连接失败: ${e.message}`);
    process.exit(1);
  }
  const connectDuration = Date.now() - connectStart;
  console.log(`      全部连接就绪，耗时 ${connectDuration}ms\n`);

  // ── 阶段 3：广播延迟测试 ────────────────────────────────────────────
  console.log('[3/4] 广播延迟测试（发起 wheel_started 事件）...');

  const broadcastLatencies = [];
  const BROADCAST_ROUNDS = 5;

  for (let round = 0; round < BROADCAST_ROUNDS; round++) {
    const sendTime = Date.now();
    const receivePromises = clients.map(({ ws, receivedEvents }) =>
      new Promise((resolve) => {
        const check = setInterval(() => {
          const ev = receivedEvents.find(e => e.event === 'wheel_spin' && e.ts >= sendTime);
          if (ev) {
            clearInterval(check);
            resolve(ev.ts - sendTime);
          }
        }, 5);
        setTimeout(() => { clearInterval(check); resolve(LATENCY_P95_LIMIT + 1000); }, 3000);
      })
    );

    // 发起者发送 wheel_started
    clients[0].ws.send(JSON.stringify({ event: 'wheel_started' }));

    const latencies = await Promise.all(receivePromises);
    broadcastLatencies.push(...latencies);

    await new Promise(r => setTimeout(r, 200)); // 轮次间隔
  }

  // ── 阶段 4：统计报告 ────────────────────────────────────────────────
  console.log('[4/4] 统计结果...\n');

  const validLatencies = broadcastLatencies.filter(l => l < LATENCY_P95_LIMIT + 1000);
  const sorted = [...validLatencies].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.50)] || 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
  const avg = validLatencies.length
    ? Math.round(validLatencies.reduce((s, l) => s + l, 0) / validLatencies.length)
    : 0;
  const max = sorted[sorted.length - 1] || 0;

  const timeouts = broadcastLatencies.length - validLatencies.length;
  const successRate = ((validLatencies.length / broadcastLatencies.length) * 100).toFixed(1);

  console.log('───────────────────────────────────────────────────');
  console.log('  广播延迟统计（单位：ms）');
  console.log('───────────────────────────────────────────────────');
  console.log(`  并发连接数:   ${NUM_CLIENTS}`);
  console.log(`  广播轮次:     ${BROADCAST_ROUNDS}`);
  console.log(`  总样本数:     ${broadcastLatencies.length}`);
  console.log(`  成功率:       ${successRate}%`);
  console.log(`  平均延迟:     ${avg}ms`);
  console.log(`  P50 延迟:     ${p50}ms`);
  console.log(`  P95 延迟:     ${p95}ms`);
  console.log(`  P99 延迟:     ${p99}ms`);
  console.log(`  最大延迟:     ${max}ms`);
  console.log(`  超时次数:     ${timeouts}`);
  console.log('───────────────────────────────────────────────────');

  const p95Pass = p95 < LATENCY_P95_LIMIT;
  const successPass = parseFloat(successRate) >= 95;

  console.log('\n  验收结果:');
  console.log(`  ${p95Pass ? '✅' : '❌'} P95 延迟 ${p95}ms < ${LATENCY_P95_LIMIT}ms`);
  console.log(`  ${successPass ? '✅' : '❌'} 成功率 ${successRate}% >= 95%`);
  console.log('───────────────────────────────────────────────────\n');

  // 关闭所有连接
  clients.forEach(({ ws }) => ws.terminate());

  const passed = p95Pass && successPass;
  console.log(passed
    ? '🎉 压测通过！WebSocket 并发性能满足 NFR-03/NFR-04 要求'
    : '⚠️  压测未通过，请检查服务器性能或网络状况'
  );

  process.exit(passed ? 0 : 1);
}

runStressTest().catch(e => {
  console.error('压测异常终止:', e.message);
  process.exit(1);
});
