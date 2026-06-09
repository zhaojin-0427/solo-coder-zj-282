const express = require('express');
const router = express.Router();
const { storage, normalizeUserId } = require('../storage/memoryStorage');
const { success, error } = require('../utils/response');
const {
  validateInventoryReport,
  validateBurningRecord,
  validateUserId,
  validateUserIdConflict,
  validatePredictionDays,
  validateReplenishmentList,
  parseStrictPositiveInteger
} = require('../utils/validator');
const consumptionService = require('../services/consumptionService');
const inventoryService = require('../services/inventoryService');
const tipsService = require('../services/tipsService');
const userProfileService = require('../services/userProfileService');

router.post('/inventory/report', (req, res) => {
  try {
    const validation = validateInventoryReport(req.body);
    if (!validation.valid) {
      return res.json(error(400, '参数校验失败', validation.errors));
    }

    const userIdValidation = validateUserIdConflict(req.query.userId, req.body.userId);
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

    res.json(success({
      userId,
      inventory: inventoryItem,
      burningRecord,
      anomalies,
      tips
    }, '库存上报成功'));
  } catch (err) {
    res.json(error(400, err.message));
  }
});

router.get('/inventory', (req, res) => {
  try {
    const userIdValidation = validateUserId(req.query.userId, true);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data;
    const { brand, scene } = req.query;

    const filters = { userId };
    if (brand) filters.brand = brand;
    if (scene) filters.scene = scene;

    const inventory = storage.getInventory(filters);
    res.json(success({ userId, inventory }));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.post('/burning/record', (req, res) => {
  try {
    const validation = validateBurningRecord(req.body);
    if (!validation.valid) {
      return res.json(error(400, '参数校验失败', validation.errors));
    }

    const userIdValidation = validateUserIdConflict(req.query.userId, req.body.userId);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data;
    const { candleId, brand, capacity, actualBurned, burnHours, temperature, humidity, scene } = validation.data;

    let candle = null;
    if (candleId) {
      candle = storage.getCandleById(candleId);
    } else if (brand && capacity) {
      candle = storage.getCandleByBrandAndCapacity(brand, capacity);
    }

    if (!candle) {
      return res.json(error(404, '未找到对应的蜡烛信息'));
    }

    const burningRecord = storage.addBurningRecord({
      candleId: candle.id,
      brand: candle.brand,
      capacity: candle.capacity,
      actualBurned,
      burnHours,
      temperature: temperature !== undefined ? temperature : 22,
      humidity: humidity !== undefined ? humidity : 50,
      scene
    }, userId);

    const anomalies = consumptionService.detectAnomaly(burningRecord);
    const tips = tipsService.getTipsForAnomalies(anomalies);

    res.json(success({
      userId,
      burningRecord,
      anomalies,
      tips
    }, '燃烧记录上报成功'));
  } catch (err) {
    res.json(error(400, err.message));
  }
});

router.get('/burning/records', (req, res) => {
  try {
    const userIdValidation = validateUserId(req.query.userId, true);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data;
    const { brand, candleId, scene } = req.query;

    const filters = { userId };
    if (brand) filters.brand = brand;
    if (candleId !== undefined && candleId !== '') {
      const parsedId = parseStrictPositiveInteger(candleId);
      if (parsedId === null) {
        return res.json(error(400, 'candleId 必须是有效的正整数（≥1）'));
      }
      filters.candleId = parsedId;
    }
    if (scene) filters.scene = scene;

    const records = storage.getBurningRecords(filters);
    res.json(success({ userId, records, count: records.length }));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.post('/consumption/model/:candleId', (req, res) => {
  try {
    const { candleId } = req.params;
    const userIdValidation = validateUserIdConflict(req.query.userId, req.body.userId);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data;
    const parsedCandleId = parseStrictPositiveInteger(candleId);
    if (parsedCandleId === null) {
      return res.json(error(400, 'candleId 必须是有效的正整数（≥1）'));
    }

    const candle = storage.getCandleById(parsedCandleId);
    if (!candle) {
      return res.json(error(404, '未找到该蜡烛'));
    }

    const records = storage.getBurningRecords({ userId, candleId: parsedCandleId });
    if (records.length === 0) {
      return res.json(error(400, '该蜡烛暂无燃烧记录，无法建立消耗模型'));
    }

    const model = consumptionService.buildConsumptionModel(parsedCandleId, records, userId);

    res.json(success({ userId, model }, '消耗模型建立成功'));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/consumption/model/:candleId', (req, res) => {
  try {
    const { candleId } = req.params;
    const userIdValidation = validateUserId(req.query.userId, true);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data;
    const parsedCandleId = parseStrictPositiveInteger(candleId);
    if (parsedCandleId === null) {
      return res.json(error(400, 'candleId 必须是有效的正整数（≥1）'));
    }

    const model = storage.getConsumptionModel(parsedCandleId, userId);
    if (!model) {
      return res.json(error(404, '未找到该蜡烛的消耗模型'));
    }

    res.json(success({ userId, model }));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/consumption/models', (req, res) => {
  try {
    const userIdValidation = validateUserId(req.query.userId, true);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data;
    const models = storage.getAllConsumptionModels(userId);
    res.json(success({ userId, models }));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/profile', (req, res) => {
  try {
    const userIdValidation = validateUserId(req.query.userId, true);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data;
    const profile = userProfileService.generateUserProfile(userId);

    res.json(success(profile, profile.profileStatus === 'complete' ? '用户画像查询成功' : profile.message));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/prediction', (req, res) => {
  try {
    const userIdValidation = validateUserId(req.query.userId, true);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const daysValidation = validatePredictionDays(req.query.days);
    if (!daysValidation.valid) {
      return res.json(error(400, '参数校验失败', daysValidation.errors));
    }

    const userId = userIdValidation.data;
    const days = daysValidation.data;

    const result = userProfileService.generateInventoryPrediction(userId, days);

    if (result.dataErrors && result.dataErrors.length > 0) {
      return res.json(success(result, '部分库存数据异常，已跳过'));
    }

    res.json(success(result));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/replenishment', (req, res) => {
  try {
    const validation = validateReplenishmentList(req.query);
    if (!validation.valid) {
      return res.json(error(400, '参数校验失败', validation.errors));
    }

    const { userId, days } = validation.data;
    const result = userProfileService.generateReplenishmentList(userId, days);

    res.json(success(result, result.status === 'success' ? '补货清单生成成功' : result.message));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/tips/personalized', (req, res) => {
  try {
    const userIdValidation = validateUserId(req.query.userId, true);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data;
    const result = tipsService.getPersonalizedTipsForUser(userId);

    res.json(success(result));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

module.exports = router;
