const express = require('express');
const router = express.Router();
const { storage, DEFAULT_USER_ID } = require('../storage/memoryStorage');
const { success, error } = require('../utils/response');
const {
  validateUserId,
  validateRecommendationQuery,
  validateSeasonCode,
  parseStrictPositiveInteger
} = require('../utils/validator');
const recommendationService = require('../services/recommendationService');

router.post('/', (req, res) => {
  try {
    const validation = validateRecommendationQuery(req.body);
    if (!validation.valid) {
      return res.json(error(400, '参数校验失败', validation.errors));
    }

    const userIdValidation = validateUserId(req.query.userId || req.body.userId, false);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data || DEFAULT_USER_ID;
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

router.get('/by-room/:scene', (req, res) => {
  try {
    const { scene } = req.params;
    if (typeof scene !== 'string' || scene.trim() === '') {
      return res.json(error(400, 'scene 必须是非空字符串'));
    }

    const userIdValidation = validateUserId(req.query.userId, false);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data || DEFAULT_USER_ID;

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

router.get('/by-mood/:mood', (req, res) => {
  try {
    const { mood } = req.params;
    if (typeof mood !== 'string' || mood.trim() === '') {
      return res.json(error(400, 'mood 必须是非空字符串'));
    }

    const userIdValidation = validateUserId(req.query.userId, false);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data || DEFAULT_USER_ID;

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

router.get('/by-season/:season', (req, res) => {
  try {
    const { season } = req.params;
    const seasonValidation = validateSeasonCode(season);
    if (!seasonValidation.valid) {
      return res.json(error(400, '参数校验失败', seasonValidation.errors));
    }

    const userIdValidation = validateUserId(req.query.userId, false);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data || DEFAULT_USER_ID;

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

router.get('/inventory-usage', (req, res) => {
  try {
    const userIdValidation = validateUserId(req.query.userId, false);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data || DEFAULT_USER_ID;

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

router.get('/purchase-suggestions', (req, res) => {
  try {
    const userIdValidation = validateUserId(req.query.userId, false);
    if (!userIdValidation.valid) {
      return res.json(error(400, '参数校验失败', userIdValidation.errors));
    }

    const userId = userIdValidation.data || DEFAULT_USER_ID;

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
