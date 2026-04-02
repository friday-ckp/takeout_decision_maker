const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  listRestaurants, listPublicRestaurants, createRestaurant,
  updateRestaurant, deleteRestaurant,
  listTrash, restoreRestaurant,
  importRestaurants,
  toggleFavorite,
  toggleBlock, listBlacklist,
} = require('../controllers/restaurantsController');

// Story 9.2: 公共餐厅池，无需登录
router.get('/public', listPublicRestaurants);

router.use(requireAuth);

// 列表 & 新增（Story 9.3: 已合并公共池 + 个人池）
router.get('/',        listRestaurants);
router.post('/',       createRestaurant);

// 批量导入（注意放在 /:id 路由前面）
router.post('/import', importRestaurants);

// 回收站
router.get('/trash',           listTrash);
router.post('/:id/restore',    restoreRestaurant);

// 黑名单
router.get('/blacklist',       listBlacklist);

// 收藏 / 拉黑
router.post('/:id/favorite',   toggleFavorite);
router.post('/:id/block',      toggleBlock);

// 单条编辑 / 删除
router.put('/:id',    updateRestaurant);
router.delete('/:id', deleteRestaurant);

module.exports = router;
