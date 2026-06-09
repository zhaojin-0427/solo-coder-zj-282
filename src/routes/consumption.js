const express = require('express');
const router = express.Router();
const storage = require('../storage/memoryStorage');
const consumptionService = require('../services/consumptionService');
const { success, error } = require('../utils/response');

router.post('/model/:candleId', (req, res) => {
  try {
    const { candleId } = req.params;
    const candle = storage.getCandleById(parseInt(candleId));

    if (!candle) {
      return res.json(error(404, '未找到该蜡烛'));
    }

    const records = storage.getBurningRecords({ candleId: parseInt(candleId) });
    if (records.length === 0) {
      return res.json(error(400, '该蜡烛暂无燃烧记录，无法建立消耗模型'));
    }

    const model = consumptionService.buildConsumptionModel(parseInt(candleId), records);
    storage.saveConsumptionModel(parseInt(candleId), model);

    res.json(success(model, '消耗模型建立成功'));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/model/:candleId', (req, res) => {
  try {
    const { candleId } = req.params;
    const model = storage.getConsumptionModel(parseInt(candleId));

    if (!model) {
      return res.json(error(404, '未找到该蜡烛的消耗模型'));
    }

    res.json(success(model));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/efficiency', (req, res) => {
  try {
    const brandEfficiencies = consumptionService.getBrandEfficiency();
    res.json(success({
      brandEfficiencies,
      warningDays: 7
    }));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/models', (req, res) => {
  try {
    const models = storage.getAllConsumptionModels();
    res.json(success(models));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

module.exports = router;
