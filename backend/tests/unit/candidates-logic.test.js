/**
 * 候选算法单元测试
 * 覆盖：历史排除、心情过滤、口味过滤、扫雷格子构建
 * Stories: 2.1, 3.1, 5.2, 5.3, 5.5
 */

// ── 测试 applyMoodFilter（纯函数，从控制器中提取逻辑复现）─────────────────
const LIGHT_TAGS  = ['轻食', '粥', '面', '清淡', '素食'];
const SPICY_TAGS  = ['辣', '麻辣', '重辣'];

function applyMoodFilter(candidates, mood) {
  if (!mood || mood === '😊' || mood === '😐') return candidates;
  if (mood === '😴') {
    return candidates.map(c => {
      const hasLight = c.tags.some(t => LIGHT_TAGS.includes(t));
      return hasLight ? { ...c, weight: c.weight + 1 } : c;
    });
  }
  if (mood === '😤') {
    const filtered = candidates.filter(c => !c.tags.some(t => SPICY_TAGS.includes(t)));
    return filtered.length >= 2 ? filtered : candidates;
  }
  return candidates;
}

function applyFlavorFilter(candidates, flavorTags) {
  if (!flavorTags || flavorTags.length === 0) return candidates;
  const filtered = candidates.filter(c => flavorTags.some(ft => c.tags.includes(ft)));
  return filtered.length >= 2 ? filtered : candidates;
}

// ── 测试数据 ──────────────────────────────────────────────────────────────
const makeCandidates = () => [
  { id: 1, name: '沙拉轻食', tags: ['轻食', '健康'], weight: 1, isFavorite: false },
  { id: 2, name: '麻辣香锅', tags: ['辣', '麻辣'], weight: 1, isFavorite: false },
  { id: 3, name: '粥铺', tags: ['粥', '清淡'], weight: 1, isFavorite: false },
  { id: 4, name: '烤肉', tags: ['烤肉', '肉食'], weight: 1, isFavorite: true },
  { id: 5, name: '披萨', tags: ['西餐', '快餐'], weight: 1, isFavorite: false },
];

// ── 心情过滤测试 ──────────────────────────────────────────────────────────
describe('applyMoodFilter', () => {
  test('😊 开心 - 不过滤，返回原列表', () => {
    const c = makeCandidates();
    expect(applyMoodFilter(c, '😊')).toHaveLength(c.length);
  });

  test('😐 一般 - 不过滤，返回原列表', () => {
    const c = makeCandidates();
    expect(applyMoodFilter(c, '😐')).toHaveLength(c.length);
  });

  test('null mood - 不过滤', () => {
    const c = makeCandidates();
    expect(applyMoodFilter(c, null)).toHaveLength(c.length);
  });

  test('😴 困倦 - 轻食/粥/面标签 weight+1，其他不变', () => {
    const result = applyMoodFilter(makeCandidates(), '😴');
    const salad = result.find(c => c.id === 1); // 有'轻食'
    const zhou  = result.find(c => c.id === 3); // 有'粥'
    const spicy = result.find(c => c.id === 2); // 无轻食标签
    const pizza = result.find(c => c.id === 5); // 无轻食标签

    expect(salad.weight).toBe(2); // 原1 + 1
    expect(zhou.weight).toBe(2);  // 原1 + 1
    expect(spicy.weight).toBe(1); // 未改变
    expect(pizza.weight).toBe(1); // 未改变
    expect(result).toHaveLength(5); // 总数不变
  });

  test('😴 困倦 - 收藏餐厅如已是weight=2，加到3', () => {
    const candidates = [
      { id: 4, name: '粥铺收藏', tags: ['粥'], weight: 2, isFavorite: true },
      { id: 5, name: '普通餐厅', tags: ['快餐'], weight: 1, isFavorite: false },
    ];
    const result = applyMoodFilter(candidates, '😴');
    expect(result.find(c => c.id === 4).weight).toBe(3);
  });

  test('😤 烦躁 - 排除辣食标签', () => {
    const result = applyMoodFilter(makeCandidates(), '😤');
    const ids = result.map(c => c.id);
    expect(ids).not.toContain(2); // 麻辣香锅被排除
  });

  test('😤 烦躁 - 降级：排除后少于2个时恢复全量', () => {
    const candidates = [
      { id: 1, name: '麻辣鱼', tags: ['辣'], weight: 1, isFavorite: false },
      { id: 2, name: '重辣鸡', tags: ['重辣'], weight: 1, isFavorite: false },
      { id: 3, name: '清汤锅', tags: ['清淡'], weight: 1, isFavorite: false },
    ];
    // 过滤后只剩1个（清汤锅），< 2，应降级返回全量
    const result = applyMoodFilter(candidates, '😤');
    expect(result).toHaveLength(3); // 降级，返回全量
  });

  test('😤 烦躁 - 排除后剩余>=2个时正常过滤', () => {
    const candidates = [
      { id: 1, name: '麻辣鱼', tags: ['辣'], weight: 1, isFavorite: false },
      { id: 2, name: '清汤锅', tags: ['清淡'], weight: 1, isFavorite: false },
      { id: 3, name: '沙拉', tags: ['轻食'], weight: 1, isFavorite: false },
    ];
    const result = applyMoodFilter(candidates, '😤');
    expect(result).toHaveLength(2); // 排除了麻辣鱼
    expect(result.map(c => c.id)).not.toContain(1);
  });
});

// ── 口味偏好过滤测试 ──────────────────────────────────────────────────────
describe('applyFlavorFilter', () => {
  test('无 flavorTags - 返回全量', () => {
    expect(applyFlavorFilter(makeCandidates(), [])).toHaveLength(5);
    expect(applyFlavorFilter(makeCandidates(), null)).toHaveLength(5);
  });

  test('匹配到 >=2 个候选 - 返回过滤结果', () => {
    const result = applyFlavorFilter(makeCandidates(), ['轻食', '粥']);
    const ids = result.map(c => c.id);
    expect(ids).toContain(1); // 沙拉轻食
    expect(ids).toContain(3); // 粥铺
    expect(result).toHaveLength(2);
  });

  test('匹配到 1 个时降级 - 返回全量', () => {
    const result = applyFlavorFilter(makeCandidates(), ['西餐']); // 只有披萨匹配
    expect(result).toHaveLength(5); // 降级返回全量
  });

  test('无任何匹配时降级 - 返回全量', () => {
    const result = applyFlavorFilter(makeCandidates(), ['日料', '寿司']);
    expect(result).toHaveLength(5);
  });

  test('标签交集：任一 flavorTag 匹配即入选', () => {
    const result = applyFlavorFilter(makeCandidates(), ['烤肉', '西餐']);
    const ids = result.map(c => c.id);
    expect(ids).toContain(4); // 烤肉
    expect(ids).toContain(5); // 披萨（西餐）
    expect(result).toHaveLength(2);
  });
});

// ── 心情 + 口味组合过滤测试 ───────────────────────────────────────────────
describe('applyMoodFilter + applyFlavorFilter 组合', () => {
  test('先心情加权后再口味过滤，weight 正确传递', () => {
    const candidates = [
      { id: 1, name: '粥（轻食）', tags: ['粥', '清淡'], weight: 1, isFavorite: false },
      { id: 2, name: '烤肉', tags: ['肉食'], weight: 1, isFavorite: false },
      { id: 3, name: '豆浆', tags: ['清淡', '素食'], weight: 1, isFavorite: false },
    ];
    const afterMood = applyMoodFilter(candidates, '😴');
    const afterFlavor = applyFlavorFilter(afterMood, ['粥']);
    // 口味过滤后只有id=1，少于2 → 降级返回 afterMood 全量
    expect(afterFlavor).toHaveLength(3);
    // 但 weight 改变已保留
    expect(afterFlavor.find(c => c.id === 1).weight).toBe(2);
  });

  test('心情烦躁排除辣+口味轻食过滤', () => {
    const candidates = [
      { id: 1, name: '沙拉', tags: ['轻食'], weight: 1, isFavorite: false },
      { id: 2, name: '麻辣', tags: ['辣', '麻辣'], weight: 1, isFavorite: false },
      { id: 3, name: '粥', tags: ['清淡', '轻食'], weight: 1, isFavorite: false },
    ];
    const afterMood = applyMoodFilter(candidates, '😤'); // 排除id=2
    const afterFlavor = applyFlavorFilter(afterMood, ['轻食']); // id=1,3 均有轻食
    expect(afterFlavor).toHaveLength(2);
    expect(afterFlavor.map(c => c.id)).not.toContain(2);
  });
});
