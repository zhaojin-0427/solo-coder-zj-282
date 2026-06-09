const express = require('express');
const router = express.Router();
const storage = require('../storage/memoryStorage');
const { success, error } = require('../utils/response');
const { validateInventoryReport } = require('../utils/validator');

router.post('/report', (req, res) => {
  try {
    const validation = validateInventoryReport(req.body);
    if (!validation.valid) {
      return res.json(error(400, '参数校验失败', validation.errors));
    }

    const { brand, capacity, quantity, actualBurned, burnHours, temperature, humidity } = validation.data;

    const candle = storage.getCandleByBrandAndCapacity(brand, capacity);
    if (!candle) {
      return res.json(error(404, '未找到该品牌和规格的蜡烛信息'));
    }

    const inventoryItem = storage.addInventoryItem({
      brand,
      capacity,
      quantity
    });

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
        humidity: humidity !== undefined ? humidity : 50
      });

      anomalies = consumptionService.detectAnomaly(burningRecord);
      if (anomalies.length > 0) {
        tips = tipsService.getTipsForAnomalies(anomalies);
      }
    }

    res.json(success({
      inventory: inventoryItem,
      burningRecord,
      anomalies,
      tips
    }, '库存上报成功'));
  } catch (err) {
    res.json(error(400, err.message));
  }
});

router.get('/', (req, res) => {
  try {
    const { brand } = req.query;
    const inventory = storage.getInventory(brand ? { brand } : {});
    res.json(success(inventory));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

module.exports = router;
