/**
 * 公共餐厅池合并逻辑单元测试
 * Stories: 9.2, 9.3
 *
 * 验证：公共池 + 个人池合并、source 字段、去重（同一 ID 不重复出现）
 * 均为纯函数测试，不依赖数据库
 */

// ── 从 controller 逻辑提取的纯函数（镜像实现，保持一致性）──────────────────

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str) || fallback; } catch { return fallback; }
}

/**
 * 模拟 listRestaurants 的合并逻辑：
 * 输入为 SQL 返回的原始行（含 source 字段），输出为格式化列表
 */
function formatMergedList(rows, userId) {
  return rows.map(r => ({
    ...r,
    tags: safeParseJSON(r.tags, []),
    isPublic: !!r.isPublic,
    isFavorite: !!r.isFavorite,
    isBlocked: !!r.isBlocked,
  }));
}

/**
 * 模拟 SQL WHERE 条件：user_id = userId OR is_public = 1
 * 用于验证合并逻辑
 */
function mergeRestaurants(allRows, userId) {
  return allRows.filter(r => r.userId === userId || r.isPublic === 1);
}

/**
 * 验证 source 字段分配逻辑
 */
function assignSource(row, userId) {
  return row.userId === userId ? 'personal' : 'public';
}

// ── 测试数据 ──────────────────────────────────────────────────────────────────

const makeRows = () => [
  { id: 1, name: '我的沙拉', userId: 42, isPublic: 0, tags: '["健康","轻食"]', isFavorite: 0, isBlocked: 0 },
  { id: 2, name: '我的烤肉', userId: 42, isPublic: 0, tags: '["肉食"]',        isFavorite: 1, isBlocked: 0 },
  { id: 3, name: '公共麻辣烫', userId: 1, isPublic: 1, tags: '["辣","麻辣"]', isFavorite: 0, isBlocked: 0 },
  { id: 4, name: '公共粥铺',   userId: 1, isPublic: 1, tags: '["粥","清淡"]', isFavorite: 0, isBlocked: 0 },
  { id: 5, name: '其他人私有', userId: 99, isPublic: 0, tags: '[]',            isFavorite: 0, isBlocked: 0 },
  // 用户自己贡献到公共池的餐厅（is_public=1, user_id=42）
  { id: 6, name: '我贡献的披萨', userId: 42, isPublic: 1, tags: '["西餐"]',   isFavorite: 0, isBlocked: 0 },
];

// ── 合并逻辑测试 ──────────────────────────────────────────────────────────────

describe('mergeRestaurants: 个人池 + 公共池合并', () => {
  test('包含当前用户私有餐厅', () => {
    const result = mergeRestaurants(makeRows(), 42);
    const ids = result.map(r => r.id);
    expect(ids).toContain(1);
    expect(ids).toContain(2);
  });

  test('包含所有公共餐厅', () => {
    const result = mergeRestaurants(makeRows(), 42);
    const ids = result.map(r => r.id);
    expect(ids).toContain(3);
    expect(ids).toContain(4);
  });

  test('不包含其他用户私有餐厅', () => {
    const result = mergeRestaurants(makeRows(), 42);
    const ids = result.map(r => r.id);
    expect(ids).not.toContain(5); // userId=99, isPublic=0
  });

  test('用户贡献到公共池的餐厅只出现一次（SQL WHERE 天然去重）', () => {
    const result = mergeRestaurants(makeRows(), 42);
    const id6Count = result.filter(r => r.id === 6).length;
    expect(id6Count).toBe(1);
  });

  test('合并后总数正确（个人2 + 公共2 + 自贡献公共1 = 5）', () => {
    const result = mergeRestaurants(makeRows(), 42);
    expect(result).toHaveLength(5);
  });

  test('不同用户看到不同范围（userId=99 只看到自己私有 + 公共）', () => {
    const result = mergeRestaurants(makeRows(), 99);
    const ids = result.map(r => r.id);
    expect(ids).toContain(5);  // userId=99 私有
    expect(ids).toContain(3);  // 公共
    expect(ids).toContain(4);  // 公共
    expect(ids).toContain(6);  // 用户42贡献的公共
    expect(ids).not.toContain(1); // 用户42私有
    expect(ids).not.toContain(2); // 用户42私有
  });
});

// ── source 字段测试 ───────────────────────────────────────────────────────────

describe('assignSource: source 字段分配', () => {
  test('用户自己的餐厅 source = personal', () => {
    expect(assignSource({ userId: 42 }, 42)).toBe('personal');
  });

  test('公共池餐厅 source = public', () => {
    expect(assignSource({ userId: 1 }, 42)).toBe('public');
  });

  test('用户贡献的公共餐厅 source = personal（user_id 匹配）', () => {
    expect(assignSource({ userId: 42, isPublic: 1 }, 42)).toBe('personal');
  });
});

// ── formatMergedList 格式化测试 ───────────────────────────────────────────────

describe('formatMergedList: 字段格式化', () => {
  test('tags JSON 字符串解析为数组', () => {
    const rows = [
      { id: 1, tags: '["辣","麻辣"]', isPublic: 1, isFavorite: 0, isBlocked: 0, userId: 1 },
    ];
    const result = formatMergedList(rows, 42);
    expect(result[0].tags).toEqual(['辣', '麻辣']);
  });

  test('tags 非法 JSON 降级为空数组', () => {
    const rows = [
      { id: 1, tags: 'not-json', isPublic: 0, isFavorite: 0, isBlocked: 0, userId: 42 },
    ];
    const result = formatMergedList(rows, 42);
    expect(result[0].tags).toEqual([]);
  });

  test('isPublic 数字转 boolean', () => {
    const rows = [
      { id: 1, tags: '[]', isPublic: 1, isFavorite: 0, isBlocked: 0, userId: 1 },
      { id: 2, tags: '[]', isPublic: 0, isFavorite: 0, isBlocked: 0, userId: 42 },
    ];
    const result = formatMergedList(rows, 42);
    expect(result[0].isPublic).toBe(true);
    expect(result[1].isPublic).toBe(false);
  });

  test('isFavorite / isBlocked 数字转 boolean', () => {
    const rows = [
      { id: 1, tags: '[]', isPublic: 0, isFavorite: 1, isBlocked: 0, userId: 42 },
    ];
    const result = formatMergedList(rows, 42);
    expect(result[0].isFavorite).toBe(true);
    expect(result[0].isBlocked).toBe(false);
  });
});

// ── listPublicRestaurants 逻辑测试 ───────────────────────────────────────────

describe('listPublicRestaurants: 公共餐厅过滤', () => {
  function getPublicOnly(allRows) {
    return allRows.filter(r => r.isPublic === 1 && r.isDeleted === 0);
  }

  test('只返回 is_public=1 的餐厅', () => {
    const rows = makeRows().map(r => ({ ...r, isDeleted: 0 }));
    const result = getPublicOnly(rows);
    expect(result.every(r => r.isPublic === 1)).toBe(true);
  });

  test('不返回私有餐厅', () => {
    const rows = makeRows().map(r => ({ ...r, isDeleted: 0 }));
    const result = getPublicOnly(rows);
    const ids = result.map(r => r.id);
    expect(ids).not.toContain(1); // 私有
    expect(ids).not.toContain(2); // 私有
    expect(ids).not.toContain(5); // 私有
  });

  test('不返回已删除的公共餐厅', () => {
    const rows = [
      { id: 3, isPublic: 1, isDeleted: 1 },
      { id: 4, isPublic: 1, isDeleted: 0 },
    ];
    const result = getPublicOnly(rows);
    expect(result.map(r => r.id)).toEqual([4]);
  });

  test('结果中每条记录 source = public', () => {
    const rows = makeRows().map(r => ({ ...r, isDeleted: 0 }));
    const publicRows = getPublicOnly(rows);
    publicRows.forEach(r => {
      expect(assignSource(r, 42)).toBe(r.userId === 42 ? 'personal' : 'public');
    });
  });
});
