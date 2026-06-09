const express = require('express');
const router = express.Router();
const inventoryService = require('../services/inventoryService');
const consumptionService = require('../services/consumptionService');
const { success, error } = require('../utils/response');
const { validateUserId, validatePredictionDays } = require('../utils/validator');

router.get('/advice', (req, res) => {
  try {
    const userIdValidation = validateUserId(req.query.userId, false);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data;
    const advice = inventoryService.getReplenishmentAdvice(userId);
    const brandEfficiencies = consumptionService.getBrandEfficiency(userId);

    const responseData = {
      ...advice,
      brandEfficiencies
    };
    if (userId) responseData.userId = userId;

    res.json(success(responseData));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/prediction', (req, res) => {
  try {
    const userIdValidation = validateUserId(req.query.userId, false);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data;
    const result = inventoryService.getInventoryPrediction(userId);

    const responseData = {
      predictions: result.predictions,
      warningDays: inventoryService.WARNING_DAYS,
      validCount: result.validCount,
      invalidCount: result.invalidCount
    };
    if (userId) responseData.userId = userId;
    if (result.errors && result.errors.length > 0) {
      responseData.dataErrors = result.errors;
    }

    const message = result.errors && result.errors.length > 0 ? '部分库存数据异常，已跳过' : 'success';
    res.json(success(responseData, message));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/alerts', (req, res) => {
  try {
    const userIdValidation = validateUserId(req.query.userId, false);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data;
    const result = inventoryService.getLowInventoryAlerts(userId);

    const responseData = {
      alerts: result.alerts,
      warningDays: inventoryService.WARNING_DAYS,
      validCount: result.validCount,
      invalidCount: result.invalidCount
    };
    if (userId) responseData.userId = userId;
    if (result.errors && result.errors.length > 0) {
      responseData.dataErrors = result.errors;
    }

    const message = result.errors && result.errors.length > 0 ? '部分库存数据异常，已跳过' : 'success';
    res.json(success(responseData, message));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

module.exports = router;
