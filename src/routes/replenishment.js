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
    const predictions = inventoryService.getInventoryPrediction();
    res.json(success({
      predictions,
      warningDays: inventoryService.WARNING_DAYS
    }));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/alerts', (req, res) => {
  try {
    const alerts = inventoryService.getLowInventoryAlerts();
    res.json(success({
      alerts,
      warningDays: inventoryService.WARNING_DAYS
    }));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

module.exports = router;
