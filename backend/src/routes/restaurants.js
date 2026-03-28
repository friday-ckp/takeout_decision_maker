const express = require('express');
const router = express.Router();
const { requireUserId } = require('../middleware/auth');
const {
  listRestaurants, createRestaurant,
  updateRestaurant, deleteRestaurant,
  listTrash, restoreRestaurant,
  importRestaurants,
  toggleFavorite,
  toggleBlock, listBlacklist,
} = require('../controllers/restaurantsController');

router.use(requireUserId);

// 列表 & 新增
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
