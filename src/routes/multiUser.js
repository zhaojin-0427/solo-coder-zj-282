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
  validateUserRating,
  validateUserScentPreferences,
  validateRecommendationQuery,
  validateSeasonCode,
  parseStrictPositiveInteger,
  parseNumber
} = require('../utils/validator');
const consumptionService = require('../services/consumptionService');
const inventoryService = require('../services/inventoryService');
const tipsService = require('../services/tipsService');
const userProfileService = require('../services/userProfileService');
const recommendationService = require('../services/recommendationService');

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

router.post('/scent/rating', (req, res) => {
  try {
    const validation = validateUserRating(req.body);
    if (!validation.valid) {
      return res.json(error(400, '参数校验失败', validation.errors));
    }

    const userIdValidation = validateUserIdConflict(req.query.userId, req.body.userId);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data;
    const { candleId, rating, comment } = validation.data;

    const candle = storage.getCandleById(candleId);
    if (!candle) {
      return res.json(error(404, '未找到该蜡烛信息'));
    }

    if (!candle.fragranceCategory) {
      return res.json(error(400, '该蜡烛未配置香调信息，无法评分'));
    }

    const userRating = storage.addUserRating({ candleId, rating, comment }, userId);

    res.json(success({
      userId,
      rating: userRating,
      candle: {
        id: candle.id,
        brand: candle.brand,
        name: candle.name,
        fragranceCategory: candle.fragranceCategory,
        scentTags: candle.scentTags
      }
    }, '评分提交成功'));
  } catch (err) {
    res.json(error(400, err.message));
  }
});

router.get('/scent/ratings', (req, res) => {
  try {
    const userIdValidation = validateUserId(req.query.userId, true);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data;
    const { candleId, brand, minRating } = req.query;

    const filters = { userId };
    if (candleId) {
      const parsedId = parseStrictPositiveInteger(candleId);
      if (parsedId === null) {
        return res.json(error(400, 'candleId 必须是有效的正整数'));
      }
      filters.candleId = parsedId;
    }
    if (brand) filters.brand = brand;
    if (minRating) {
      const parsedMin = parseNumber(minRating);
      if (parsedMin === null || parsedMin < 1 || parsedMin > 5) {
        return res.json(error(400, 'minRating 必须是1-5之间的数字'));
      }
      filters.minRating = parsedMin;
    }

    const ratings = storage.getUserRatings(filters);

    const enrichedRatings = ratings.map(r => {
      const candle = storage.getCandleById(r.candleId);
      return {
        ...r,
        candle: candle ? {
          id: candle.id,
          brand: candle.brand,
          name: candle.name,
          fragranceCategory: candle.fragranceCategory,
          scentTags: candle.scentTags
        } : null
      };
    });

    res.json(success({
      userId,
      ratings: enrichedRatings,
      count: enrichedRatings.length,
      averageRating: enrichedRatings.length > 0
        ? Number((enrichedRatings.reduce((sum, r) => sum + r.rating, 0) / enrichedRatings.length).toFixed(2))
        : null
    }));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.post('/scent/preferences', (req, res) => {
  try {
    const validation = validateUserScentPreferences(req.body);
    if (!validation.valid) {
      return res.json(error(400, '参数校验失败', validation.errors));
    }

    const userIdValidation = validateUserIdConflict(req.query.userId, req.body.userId);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data;

    const existingPrefs = storage.getUserScentPreferences(userId);
    const hasData = existingPrefs !== null;

    if (Object.keys(validation.data).length === 0 && !hasData) {
      return res.json(error(400, '至少需要提供一项偏好信息'));
    }

    if (validation.data.allergyTags && validation.data.excludeTags) {
      const overlap = validation.data.allergyTags.filter(t => validation.data.excludeTags.includes(t));
      if (overlap.length > 0) {
        return res.json(error(400, `过敏标签与排斥标签存在重复: ${overlap.join(', ')}`));
      }
    }

    const preferences = storage.saveUserScentPreferences(userId, validation.data);

    const warnings = [];
    if (preferences.allergyTags) {
      const inventory = storage.getAvailableInventoryCandles(userId);
      const allergyInventory = inventory.filter(item =>
        item.candle.scentTags && item.candle.scentTags.some(tag => preferences.allergyTags.includes(tag))
      );
      if (allergyInventory.length > 0) {
        warnings.push({
          type: 'allergy_inventory_warning',
          message: '您的库存中存在含有过敏成分的蜡烛',
          items: allergyInventory.map(i => ({
            id: i.candle.id,
            brand: i.candle.brand,
            name: i.candle.name,
            quantity: i.quantity,
            conflictingTags: i.candle.scentTags.filter(t => preferences.allergyTags.includes(t))
          }))
        });
      }
    }

    res.json(success({
      userId,
      preferences,
      warnings
    }, hasData ? '偏好更新成功' : '偏好设置成功'));
  } catch (err) {
    res.json(error(400, err.message));
  }
});

router.get('/scent/preferences', (req, res) => {
  try {
    const userIdValidation = validateUserId(req.query.userId, true);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data;
    const preferences = storage.getUserScentPreferences(userId);

    if (!preferences) {
      return res.json(success({
        userId,
        preferences: null,
        message: '用户尚未设置气味偏好'
      }, '查询成功，暂无偏好数据'));
    }

    res.json(success({ userId, preferences }));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/scent/fragrance-profile', (req, res) => {
  try {
    const userIdValidation = validateUserId(req.query.userId, true);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data;

    const preferences = storage.getUserScentPreferences(userId);
    const ratings = storage.getUserRatings({ userId });

    if (!preferences && ratings.length === 0) {
      return res.json(success({
        userId,
        profileStatus: 'insufficient_data',
        message: '用户数据不足，请先上报评分或设置偏好以生成香调画像'
      }, '暂无足够数据生成画像'));
    }

    const categoryScores = {};
    const tagScores = {};
    let totalWeight = 0;

    ratings.forEach(r => {
      const candle = storage.getCandleById(r.candleId);
      if (!candle || !candle.fragranceCategory) return;

      const weight = (r.rating - 3) * 0.5 + 1;
      totalWeight += weight;

      if (!categoryScores[candle.fragranceCategory]) {
        categoryScores[candle.fragranceCategory] = 0;
      }
      categoryScores[candle.fragranceCategory] += r.rating * weight;

      if (candle.scentTags) {
        candle.scentTags.forEach(tag => {
          if (!tagScores[tag]) {
            tagScores[tag] = 0;
          }
          tagScores[tag] += r.rating * weight;
        });
      }
    });

    if (preferences?.desiredMoods) {
      preferences.desiredMoods.forEach(mood => {
        const moodMapping = storage.getMoodFragranceMapping(mood);
        moodMapping.forEach(m => {
          if (!categoryScores[m.category]) {
            categoryScores[m.category] = 0;
          }
          categoryScores[m.category] += 3 * m.weight;
          totalWeight += m.weight;
        });
      });
    }

    if (preferences?.seasonPreference) {
      const seasonMapping = storage.getSeasonFragranceMapping(preferences.seasonPreference);
      seasonMapping.forEach(s => {
        if (!categoryScores[s.category]) {
          categoryScores[s.category] = 0;
        }
        categoryScores[s.category] += 2 * s.weight;
        totalWeight += s.weight;
      });
    }

    const normalizedCategories = Object.entries(categoryScores).map(([code, score]) => {
      const category = storage.getFragranceCategoryByCode(code);
      return {
        code,
        name: category?.name || code,
        score: totalWeight > 0 ? Number((score / totalWeight * 100).toFixed(1)) : 0,
        description: category?.description || ''
      };
    }).sort((a, b) => b.score - a.score);

    const normalizedTags = Object.entries(tagScores).map(([name, score]) => ({
      name,
      score: totalWeight > 0 ? Number((score / totalWeight * 100).toFixed(1)) : 0
    })).sort((a, b) => b.score - a.score).slice(0, 10);

    const topCategory = normalizedCategories[0];
    const preferredIntensity = preferences?.intensityPreference || 'medium';

    const allergyTags = preferences?.allergyTags || [];
    const excludeTags = preferences?.excludeTags || [];

    const commonSpaces = preferences?.commonSpaces || [];
    const spaceDetails = commonSpaces.map(space => {
      const scenario = storage.getUsageScenarioByCode(space);
      return {
        code: space,
        name: scenario?.name || space,
        recommendedCategories: storage.getSceneFragranceMapping(space)
          .map(m => {
            const cat = storage.getFragranceCategoryByCode(m.category);
            return { code: m.category, name: cat?.name || m.category, weight: m.weight, reason: m.reason };
          })
      };
    });

    const desiredMoods = preferences?.desiredMoods || [];
    const moodDetails = desiredMoods.map(mood => {
      const goal = storage.getMoodGoalByCode(mood);
      return {
        code: mood,
        name: goal?.name || mood,
        recommendedCategories: storage.getMoodFragranceMapping(mood)
          .map(m => {
            const cat = storage.getFragranceCategoryByCode(m.category);
            return { code: m.category, name: cat?.name || m.category, weight: m.weight, reason: m.reason };
          })
      };
    });

    const seasonPref = preferences?.seasonPreference;
    const seasonDetail = seasonPref ? {
      code: seasonPref,
      name: storage.getSeasonPreferenceByCode(seasonPref)?.name || seasonPref,
      recommendedCategories: storage.getSeasonFragranceMapping(seasonPref)
        .map(s => {
          const cat = storage.getFragranceCategoryByCode(s.category);
          return { code: s.category, name: cat?.name || s.category, weight: s.weight, reason: s.reason };
        })
    } : null;

    const inventory = storage.getAvailableInventoryCandles(userId);
    const inventoryByCategory = {};
    inventory.forEach(item => {
      if (!item.candle.fragranceCategory) return;
      if (!inventoryByCategory[item.candle.fragranceCategory]) {
        inventoryByCategory[item.candle.fragranceCategory] = [];
      }
      inventoryByCategory[item.candle.fragranceCategory].push({
        candleId: item.candle.id,
        brand: item.candle.brand,
        name: item.candle.name,
        quantity: item.quantity,
        scentTags: item.candle.scentTags,
        intensity: item.candle.intensity
      });
    });

    const profile = {
      userId,
      profileStatus: 'complete',
      topFragranceCategory: topCategory || null,
      preferredIntensity,
      categoryPreferences: normalizedCategories,
      tagPreferences: normalizedTags,
      allergyTags,
      excludeTags,
      commonSpaces: spaceDetails,
      desiredMoods: moodDetails,
      seasonPreference: seasonDetail,
      weatherCondition: preferences?.weatherCondition || null,
      ratingSummary: {
        totalRatings: ratings.length,
        averageRating: ratings.length > 0
          ? Number((ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(2))
          : null,
        ratedBrands: [...new Set(ratings.map(r => r.brand))]
      },
      inventoryByCategory,
      lastUpdated: Date.now()
    };

    res.json(success(profile, '用户香调画像查询成功'));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.post('/scent/recommendations', (req, res) => {
  try {
    const validation = validateRecommendationQuery(req.body);
    if (!validation.valid) {
      return res.json(error(400, '参数校验失败', validation.errors));
    }

    const userIdValidation = validateUserIdConflict(req.query.userId, req.body.userId);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data;
    const { scene, mood, season, roomSize, maxCandles } = validation.data;

    if (!scene && !mood && !season) {
      return res.json(error(400, '至少需要提供 scene、mood 或 season 中的一个参数'));
    }

    const result = recommendationService.generateRecommendations(userId, {
      scene,
      mood,
      season,
      roomSize,
      maxCandles: maxCandles || 3
    });

    if (result.status === 'insufficient_data') {
      return res.json(success(result, result.message));
    }

    if (result.status === 'invalid_scene') {
      return res.json(error(400, result.message, {
        validScenes: result.validScenes
      }));
    }

    if (result.status === 'invalid_mood') {
      return res.json(error(400, result.message, {
        validMoods: result.validMoods
      }));
    }

    if (result.status === 'no_matching') {
      return res.json(success(result, result.message));
    }

    res.json(success(result, '个性化推荐生成成功'));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/scent/recommendations/by-room/:scene', (req, res) => {
  try {
    const { scene } = req.params;
    if (typeof scene !== 'string' || scene.trim() === '') {
      return res.json(error(400, 'scene 必须是非空字符串'));
    }

    const userIdValidation = validateUserId(req.query.userId, true);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data;

    const { maxCandles, roomSize } = req.query;

    const parsedMax = maxCandles ? parseStrictPositiveInteger(maxCandles) : 3;
    if (maxCandles && (parsedMax === null || parsedMax > 10)) {
      return res.json(error(400, 'maxCandles 必须是1-10之间的正整数'));
    }

    const parsedRoomSize = roomSize ? parseFloat(roomSize) : null;
    if (roomSize && (isNaN(parsedRoomSize) || parsedRoomSize <= 0)) {
      return res.json(error(400, 'roomSize 必须是有效的正数'));
    }

    const result = recommendationService.generateRecommendations(userId, {
      scene: scene.trim(),
      maxCandles: parsedMax,
      roomSize: parsedRoomSize
    });

    if (result.status === 'insufficient_data') {
      return res.json(success(result, result.message));
    }

    if (result.status === 'invalid_scene') {
      return res.json(error(400, result.message, {
        validScenes: result.validScenes
      }));
    }

    if (result.status === 'no_matching') {
      return res.json(success(result, result.message));
    }

    res.json(success(result, '按房间场景推荐生成成功'));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/scent/recommendations/by-mood/:mood', (req, res) => {
  try {
    const { mood } = req.params;
    if (typeof mood !== 'string' || mood.trim() === '') {
      return res.json(error(400, 'mood 必须是非空字符串'));
    }

    const userIdValidation = validateUserId(req.query.userId, true);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data;

    const { maxCandles, roomSize } = req.query;

    const parsedMax = maxCandles ? parseStrictPositiveInteger(maxCandles) : 3;
    if (maxCandles && (parsedMax === null || parsedMax > 10)) {
      return res.json(error(400, 'maxCandles 必须是1-10之间的正整数'));
    }

    const parsedRoomSize = roomSize ? parseFloat(roomSize) : null;
    if (roomSize && (isNaN(parsedRoomSize) || parsedRoomSize <= 0)) {
      return res.json(error(400, 'roomSize 必须是有效的正数'));
    }

    const result = recommendationService.generateRecommendations(userId, {
      mood: mood.trim(),
      maxCandles: parsedMax,
      roomSize: parsedRoomSize
    });

    if (result.status === 'insufficient_data') {
      return res.json(success(result, result.message));
    }

    if (result.status === 'invalid_mood') {
      return res.json(error(400, result.message, {
        validMoods: result.validMoods
      }));
    }

    if (result.status === 'no_matching') {
      return res.json(success(result, result.message));
    }

    res.json(success(result, '按情绪目标推荐生成成功'));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/scent/recommendations/by-season/:season', (req, res) => {
  try {
    const { season } = req.params;
    const seasonValidation = validateSeasonCode(season);
    if (!seasonValidation.valid) {
      return res.json(error(400, '参数校验失败', seasonValidation.errors));
    }

    const userIdValidation = validateUserId(req.query.userId, true);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data;

    const { maxCandles, roomSize } = req.query;

    const parsedMax = maxCandles ? parseStrictPositiveInteger(maxCandles) : 3;
    if (maxCandles && (parsedMax === null || parsedMax > 10)) {
      return res.json(error(400, 'maxCandles 必须是1-10之间的正整数'));
    }

    const parsedRoomSize = roomSize ? parseFloat(roomSize) : null;
    if (roomSize && (isNaN(parsedRoomSize) || parsedRoomSize <= 0)) {
      return res.json(error(400, 'roomSize 必须是有效的正数'));
    }

    const result = recommendationService.generateRecommendations(userId, {
      season: seasonValidation.data,
      maxCandles: parsedMax,
      roomSize: parsedRoomSize
    });

    if (result.status === 'insufficient_data') {
      return res.json(success(result, result.message));
    }

    if (result.status === 'no_matching') {
      return res.json(success(result, result.message));
    }

    res.json(success(result, '按季节推荐生成成功'));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/scent/inventory-usage', (req, res) => {
  try {
    const userIdValidation = validateUserId(req.query.userId, true);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data;

    const result = recommendationService.generateInventoryUsagePlan(userId);

    if (result.status === 'no_inventory') {
      return res.json(success(result, result.message));
    }

    if (result.status === 'no_scent_inventory') {
      return res.json(success(result, result.message));
    }

    res.json(success(result, '库存使用计划生成成功'));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/scent/purchase-suggestions', (req, res) => {
  try {
    const userIdValidation = validateUserId(req.query.userId, true);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data;

    const usagePlan = recommendationService.generateInventoryUsagePlan(userId);

    if (usagePlan.status === 'no_inventory') {
      return res.json(success({
        userId,
        status: 'no_inventory',
        message: '当前库存为空，建议先设置偏好和评分，然后采购基础香调',
        suggestions: []
      }, usagePlan.message));
    }

    const purchaseSuggestions = usagePlan.purchaseSuggestions;

    if (purchaseSuggestions.summary.missingCategoriesCount === 0 &&
        purchaseSuggestions.summary.lowStockCount === 0 &&
        purchaseSuggestions.summary.complementaryCount === 0) {
      return res.json(success({
        userId,
        status: 'no_purchase_needed',
        message: '当前库存充足，暂无采购需求',
        purchaseSuggestions
      }, '暂无采购需求'));
    }

    res.json(success({
      userId,
      status: 'success',
      purchaseSuggestions
    }, '采购建议生成成功'));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

module.exports = router;
