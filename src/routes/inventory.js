const express = require('express');
const router = express.Router();
const { storage, normalizeUserId, DEFAULT_USER_ID } = require('../storage/memoryStorage');
const { success, error } = require('../utils/response');
const { validateInventoryReport, validateBurningRecord, validateUserId, parsePositiveInteger } = require('../utils/validator');

router.post('/report', (req, res) => {
  try {
    const validation = validateInventoryReport(req.body);
    if (!validation.valid) {
      return res.json(error(400, '参数校验失败', validation.errors));
    }

    const userIdValidation = validateUserId(req.body.userId || req.query.userId, false);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data;
    const { brand, capacity, quantity, actualBurned, burnHours, temperature, humidity, scene } = validation.data;

    const candle = storage.getCandleByBrandAndCapacity(brand, capacity);
    if (!candle) {
      return res.json(error(404, '未找到该品牌和规格的蜡烛信息'));
    }

    const inventoryItem = storage.addInventoryItem({
      brand,
      capacity,
      quantity,
      scene
    }, userId);

    let burningRecord = null;
    let anomalies = [];
    let tips = [];

    if (burnHours !== undefined && actualBurned !== undefined) {
      const consumptionService = require('../services/consumptionService');
      const tipsService = require('../services/tipsService');

      burningRecord = storage.addBurningRecord({
        candleId: candle.id,
        brand,
        capacity,
        actualBurned,
        burnHours,
        temperature: temperature !== undefined ? temperature : 22,
        humidity: humidity !== undefined ? humidity : 50,
        scene
      }, userId);

      anomalies = consumptionService.detectAnomaly(burningRecord);
      if (anomalies.length > 0) {
        tips = tipsService.getTipsForAnomalies(anomalies);
      }
    }

    const responseData = {
      inventory: inventoryItem,
      burningRecord,
      anomalies,
      tips
    };
    if (userId) responseData.userId = userId;

    res.json(success(responseData, '库存上报成功'));
  } catch (err) {
    res.json(error(400, err.message));
  }
});

router.get('/', (req, res) => {
  try {
    const userIdValidation = validateUserId(req.query.userId, false);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data;
    const { brand, scene } = req.query;

    const filters = {};
    if (userId) filters.userId = userId;
    if (brand) filters.brand = brand;
    if (scene) filters.scene = scene;

    const inventory = storage.getInventory(filters);
    const responseData = { inventory };
    if (userId) responseData.userId = userId;

    res.json(success(responseData));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

module.exports = router;
