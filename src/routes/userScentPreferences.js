const express = require('express');
const router = express.Router();
const { storage, normalizeUserId } = require('../storage/memoryStorage');
const { success, error } = require('../utils/response');
const {
  validateUserId,
  validateUserIdConflict,
  validateUserRating,
  validateUserScentPreferences,
  parseStrictPositiveInteger
} = require('../utils/validator');

router.post('/rating', (req, res) => {
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

router.get('/ratings', (req, res) => {
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
      const parsedMin = parseStrictPositiveInteger(minRating);
      if (parsedMin === null || parsedMin < 1 || parsedMin > 5) {
        return res.json(error(400, 'minRating 必须是1-5之间的整数'));
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

router.post('/preferences', (req, res) => {
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

router.get('/preferences', (req, res) => {
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

router.get('/fragrance-profile', (req, res) => {
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

module.exports = router;
