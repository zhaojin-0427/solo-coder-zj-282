const express = require('express');
const router = express.Router();
const tipsService = require('../services/tipsService');
const { success, error } = require('../utils/response');

router.get('/personalized/:candleId', (req, res) => {
  try {
    const { candleId } = req.params;
    const result = tipsService.getPersonalizedTips(parseInt(candleId));
    res.json(success(result));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/type/:type', (req, res) => {
  try {
    const { type } = req.params;
    const tips = tipsService.getTipsByType(type);
    res.json(success({ tips }));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/', (req, res) => {
  try {
    const tips = tipsService.getAllTips();
    res.json(success({ tips }));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

module.exports = router;
