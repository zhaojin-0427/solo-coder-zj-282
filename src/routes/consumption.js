const express = require('express');
const router = express.Router();
const { storage } = require('../storage/memoryStorage');
const consumptionService = require('../services/consumptionService');
const { success, error } = require('../utils/response');
const { validateUserId, validatePositiveInteger, parsePositiveInteger } = require('../utils/validator');

router.post('/model/:candleId', (req, res) => {
  try {
    const { candleId } = req.params;
    const userIdValidation = validateUserId(req.query.userId || req.body.userId, false);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data;
    const parsedCandleId = parsePositiveInteger(candleId);
    if (parsedCandleId === null) {
      return res.json(error(400, 'candleId 必须是有效的正整数'));
    }

    const candle = storage.getCandleById(parsedCandleId);
    if (!candle) {
      return res.json(error(404, '未找到该蜡烛'));
    }

    const filters = { candleId: parsedCandleId };
    if (userId) filters.userId = userId;

    const records = storage.getBurningRecords(filters);
    if (records.length === 0) {
      return res.json(error(400, '该蜡烛暂无燃烧记录，无法建立消耗模型'));
    }

    const model = consumptionService.buildConsumptionModel(parsedCandleId, records, userId);

    const responseData = { model };
    if (userId) responseData.userId = userId;

    res.json(success(responseData, '消耗模型建立成功'));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/model/:candleId', (req, res) => {
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

    const model = storage.getConsumptionModel(parsedCandleId, userId);
    if (!model) {
      return res.json(error(404, '未找到该蜡烛的消耗模型'));
    }

    const responseData = { model };
    if (userId) responseData.userId = userId;

    res.json(success(responseData));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/efficiency', (req, res) => {
  try {
    const userIdValidation = validateUserId(req.query.userId, false);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data;
    const brandEfficiencies = consumptionService.getBrandEfficiency(userId);

    const responseData = {
      brandEfficiencies,
      warningDays: 7
    };
    if (userId) responseData.userId = userId;

    res.json(success(responseData));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/models', (req, res) => {
  try {
    const userIdValidation = validateUserId(req.query.userId, false);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data;
    const models = storage.getAllConsumptionModels(userId);

    const responseData = { models };
    if (userId) responseData.userId = userId;

    res.json(success(responseData));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

module.exports = router;
