const express = require('express');
const router = express.Router();
const tipsService = require('../services/tipsService');
const { success, error } = require('../utils/response');
const { validateUserId, validatePositiveInteger, parsePositiveInteger } = require('../utils/validator');

router.get('/personalized/:candleId', (req, res) => {
  try {
    const { candleId } = req.params;
    const userIdValidation = validateUserId(req.query.userId, false);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data;
    const parsedCandleId = parsePositiveInteger(candleId);
    if (parsedCandleId === null) {
      return res.json(error(400, 'candleId 必须是有效的正整数'));
    }

    const result = tipsService.getPersonalizedTips(parsedCandleId, userId);

    const responseData = { ...result };
    if (userId) responseData.userId = userId;

    res.json(success(responseData));
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
