const express = require('express');
const router = express.Router();
const { storage, DEFAULT_USER_ID } = require('../storage/memoryStorage');
const { success, error } = require('../utils/response');
const {
  validateRecipientProfile,
  validateGiftBoxRecommendationQuery,
  validateSubscriptionPlanQuery,
  validateBudgetCombinationQuery,
  validateStockAlternativeQuery,
  validateGiftMessageQuery,
  validateUserId,
  parseStrictPositiveInteger
} = require('../utils/validator');
const giftBoxService = require('../services/giftBoxService');

router.post('/recipient', (req, res) => {
  try {
    const validation = validateRecipientProfile(req.body);
    if (!validation.valid) {
      return res.json(error(400, '参数校验失败', validation.errors));
    }

    const profile = storage.addRecipientProfile(validation.data, DEFAULT_USER_ID);
    res.json(success({ profile }, '收礼人档案创建成功'));
  } catch (err) {
    res.json(error(400, err.message));
  }
});

router.get('/recipients', (req, res) => {
  try {
    const profiles = storage.getRecipientProfiles(DEFAULT_USER_ID);
    res.json(success({ profiles, count: profiles.length }));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/recipient/:id', (req, res) => {
  try {
    const { id } = req.params;
    const parsedId = parseStrictPositiveInteger(id);
    if (parsedId === null) {
      return res.json(error(400, '收礼人ID必须是有效的正整数（≥1）'));
    }

    const profile = storage.getRecipientProfileById(parsedId, DEFAULT_USER_ID);
    if (!profile) {
      return res.json(error(404, '未找到该收礼人档案'));
    }

    res.json(success({ profile }));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.put('/recipient/:id', (req, res) => {
  try {
    const { id } = req.params;
    const parsedId = parseStrictPositiveInteger(id);
    if (parsedId === null) {
      return res.json(error(400, '收礼人ID必须是有效的正整数（≥1）'));
    }

    const existing = storage.getRecipientProfileById(parsedId, DEFAULT_USER_ID);
    if (!existing) {
      return res.json(error(404, '未找到该收礼人档案'));
    }

    const validation = validateRecipientProfile(req.body);
    if (!validation.valid) {
      return res.json(error(400, '参数校验失败', validation.errors));
    }

    const profile = storage.updateRecipientProfile(parsedId, validation.data, DEFAULT_USER_ID);
    res.json(success({ profile }, '收礼人档案更新成功'));
  } catch (err) {
    res.json(error(400, err.message));
  }
});

router.delete('/recipient/:id', (req, res) => {
  try {
    const { id } = req.params;
    const parsedId = parseStrictPositiveInteger(id);
    if (parsedId === null) {
      return res.json(error(400, '收礼人ID必须是有效的正整数（≥1）'));
    }

    const existing = storage.getRecipientProfileById(parsedId, DEFAULT_USER_ID);
    if (!existing) {
      return res.json(error(404, '未找到该收礼人档案'));
    }

    const deleted = storage.deleteRecipientProfile(parsedId, DEFAULT_USER_ID);
    res.json(success({ deleted }, '收礼人档案删除成功'));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.post('/recommend', (req, res) => {
  try {
    const validation = validateGiftBoxRecommendationQuery(req.body);
    if (!validation.valid) {
      return res.json(error(400, '参数校验失败', validation.errors));
    }

    const { recipientProfileId, relationship, ageGroup, preferredScents,
      allergyTags, excludeTags, minBudget, maxBudget, occasion, theme,
      intensityPreference, packagingPreference, expectedDeliveryDate,
      maxCandles, allowOutOfStock } = validation.data;

    if (!recipientProfileId && !relationship) {
      return res.json(error(400, '至少需要提供 recipientProfileId 或 relationship 中的一个参数'));
    }

    const result = giftBoxService.generateGiftBoxRecommendation(DEFAULT_USER_ID, {
      recipientProfileId,
      relationship,
      ageGroup,
      preferredScents,
      allergyTags,
      excludeTags,
      minBudget,
      maxBudget,
      occasion,
      theme,
      intensityPreference,
      packagingPreference,
      expectedDeliveryDate,
      maxCandles,
      allowOutOfStock
    });

    if (result.status === 'no_recipient') {
      return res.json(error(404, result.message, result));
    }

    if (result.status === 'no_inventory') {
      return res.json(success(result, result.message));
    }

    if (result.status === 'no_suitable') {
      return res.json(success(result, result.message));
    }

    if (result.status === 'over_budget') {
      return res.json(success(result, result.message));
    }

    res.json(success(result, '礼盒推荐生成成功'));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.post('/subscription', (req, res) => {
  try {
    const validation = validateSubscriptionPlanQuery(req.body);
    if (!validation.valid) {
      return res.json(error(400, '参数校验失败', validation.errors));
    }

    const { recipientProfileId, cycle, minBudget, maxBudget, preferredTheme,
      packagingPreference, startDate, maxCandlesPerBox, includeOccasions } = validation.data;

    if (!recipientProfileId && !validation.data.relationship) {
      return res.json(error(400, '至少需要提供 recipientProfileId 或 relationship 中的一个参数'));
    }

    const result = giftBoxService.generateSubscriptionPlan(DEFAULT_USER_ID, {
      recipientProfileId,
      cycle,
      minBudget,
      maxBudget,
      preferredTheme,
      packagingPreference,
      startDate,
      maxCandlesPerBox,
      includeOccasions,
      relationship: validation.data.relationship,
      ageGroup: validation.data.ageGroup,
      preferredScents: validation.data.preferredScents,
      allergyTags: validation.data.allergyTags,
      excludeTags: validation.data.excludeTags,
      intensityPreference: validation.data.intensityPreference
    });

    if (result.status === 'no_recipient') {
      return res.json(error(404, result.message, result));
    }

    if (result.status === 'no_inventory') {
      return res.json(success(result, result.message));
    }

    res.json(success(result, '订阅计划生成成功'));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.post('/budget-combinations', (req, res) => {
  try {
    const validation = validateBudgetCombinationQuery(req.body);
    if (!validation.valid) {
      return res.json(error(400, '参数校验失败', validation.errors));
    }

    const { minBudget, maxBudget, recipientProfileId, relationship, ageGroup,
      preferredScents, allergyTags, excludeTags, occasion, theme,
      intensityPreference, maxCombinations, minItems, maxItems } = validation.data;

    const result = giftBoxService.generateBudgetCombinations(DEFAULT_USER_ID, {
      minBudget,
      maxBudget,
      recipientProfileId,
      relationship,
      ageGroup,
      preferredScents,
      allergyTags,
      excludeTags,
      occasion,
      theme,
      intensityPreference,
      maxCombinations,
      minItems,
      maxItems
    });

    if (result.status === 'no_inventory') {
      return res.json(success(result, result.message));
    }

    if (result.status === 'no_combinations') {
      return res.json(success(result, result.message));
    }

    res.json(success(result, '预算内组合生成成功'));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.post('/stock-alternatives', (req, res) => {
  try {
    const validation = validateStockAlternativeQuery(req.body);
    if (!validation.valid) {
      return res.json(error(400, '参数校验失败', validation.errors));
    }

    const { candleIds, recipientProfileId, relationship, ageGroup,
      preferredScents, allergyTags, excludeTags, maxAlternatives } = validation.data;

    const candles = [];
    for (const cid of candleIds) {
      const candle = storage.getCandleById(cid);
      if (!candle) {
        return res.json(error(404, `未找到蜡烛产品 ID: ${cid}`));
      }
      candles.push(candle);
    }

    const result = giftBoxService.generateStockAlternatives(DEFAULT_USER_ID, {
      candleIds,
      recipientProfileId,
      relationship,
      ageGroup,
      preferredScents,
      allergyTags,
      excludeTags,
      maxAlternatives
    });

    if (result.status === 'no_alternatives') {
      return res.json(success(result, result.message));
    }

    res.json(success(result, '缺货替代方案生成成功'));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.post('/gift-message', (req, res) => {
  try {
    const validation = validateGiftMessageQuery(req.body);
    if (!validation.valid) {
      return res.json(error(400, '参数校验失败', validation.errors));
    }

    const { recipientProfileId, occasion, theme, tone, relationship,
      ageGroup, candleIds, customKeywords } = validation.data;

    let recipient = null;
    if (recipientProfileId) {
      recipient = storage.getRecipientProfileById(recipientProfileId, DEFAULT_USER_ID);
      if (!recipient) {
        return res.json(error(404, '未找到该收礼人档案'));
      }
    } else {
      recipient = {
        relationship,
        ageGroup,
        name: validation.data.recipientName
      };
    }

    const result = giftBoxService.generateGiftMessage(recipient, {
      occasion,
      theme,
      tone,
      candleIds,
      customKeywords
    });

    res.json(success({ messages: result }, '送礼文案生成成功'));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/meta/themes', (req, res) => {
  try {
    const themes = storage.getGiftBoxThemes();
    res.json(success({ themes, count: themes.length }));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/meta/relationships', (req, res) => {
  try {
    const relationships = storage.getRelationshipTypes();
    res.json(success({ relationships, count: relationships.length }));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/meta/holidays', (req, res) => {
  try {
    const holidays = storage.getHolidays();
    res.json(success({ holidays, count: holidays.length }));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/meta/budgets', (req, res) => {
  try {
    const budgets = storage.getBudgetRanges();
    res.json(success({ budgets, count: budgets.length }));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/meta/packaging', (req, res) => {
  try {
    const packaging = storage.getPackagingPreferences();
    res.json(success({ packaging, count: packaging.length }));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/meta/cycles', (req, res) => {
  try {
    const cycles = storage.getSubscriptionCycles();
    res.json(success({ cycles, count: cycles.length }));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

module.exports = router;
