const express = require('express');
const router = express.Router();
const inventoryService = require('../services/inventoryService');
const consumptionService = require('../services/consumptionService');
const { success, error } = require('../utils/response');

router.get('/advice', (req, res) => {
  try {
    const advice = inventoryService.getReplenishmentAdvice();
    const brandEfficiencies = consumptionService.getBrandEfficiency();

    res.json(success({
      ...advice,
      brandEfficiencies
    }));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/prediction', (req, res) => {
  try {
    const result = inventoryService.getInventoryPrediction();
    if (result.invalidCount > 0) {
      return res.json(success({
        predictions: result.predictions,
        warningDays: inventoryService.WARNING_DAYS,
        dataErrors: result.errors,
        validCount: result.validCount,
        invalidCount: result.invalidCount
      }, result.errors.length > 0 ? '部分库存数据异常，已跳过' : 'success'));
    }
    res.json(success({
      predictions: result.predictions,
      warningDays: inventoryService.WARNING_DAYS,
      validCount: result.validCount,
      invalidCount: result.invalidCount
    }));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/alerts', (req, res) => {
  try {
    const result = inventoryService.getLowInventoryAlerts();
    if (result.invalidCount > 0) {
      return res.json(success({
        alerts: result.alerts,
        warningDays: inventoryService.WARNING_DAYS,
        dataErrors: result.errors,
        validCount: result.validCount,
        invalidCount: result.invalidCount
      }, result.errors.length > 0 ? '部分库存数据异常，已跳过' : 'success'));
    }
    res.json(success({
      alerts: result.alerts,
      warningDays: inventoryService.WARNING_DAYS,
      validCount: result.validCount,
      invalidCount: result.invalidCount
    }));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

module.exports = router;
