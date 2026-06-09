const { storage, normalizeUserId, DEFAULT_USER_ID } = require('../storage/memoryStorage');
const { calculateCandleScore, detectScentConflicts } = require('./recommendationService');
const { parseNumber, parseStrictPositiveInteger } = require('../utils/validator');

function getRecipientPreferences(recipientProfileId, userId, options = {}) {
  const uid = userId ? normalizeUserId(userId) : DEFAULT_USER_ID;

  if (recipientProfileId) {
    const profile = storage.getRecipientProfileById(recipientProfileId, uid);
    if (!profile) {
      return null;
    }
    return {
      ...profile,
      allergyTags: profile.allergyTags || [],
      excludeTags: profile.excludeTags || [],
      preferredScents: profile.preferredScents || [],
      giftOccasions: profile.giftOccasions || []
    };
  }

  return {
    relationship: options.relationship,
    ageGroup: options.ageGroup,
    preferredScents: options.preferredScents || [],
    allergyTags: options.allergyTags || [],
    excludeTags: options.excludeTags || [],
    minBudget: options.minBudget,
    maxBudget: options.maxBudget,
    preferredTheme: options.theme,
    intensityPreference: options.intensityPreference,
    packagingPreference: options.packagingPreference,
    expectedDeliveryDate: options.expectedDeliveryDate
  };
}

function calculateGiftMatchScore(candle, recipient, options = {}) {
  const { season, occasion, theme, userId } = options;

  const allAllergyTags = [...(recipient.allergyTags || []), ...(options.allergyTags || [])];
  const allExcludeTags = [...(recipient.excludeTags || []), ...(options.excludeTags || [])];

  if (candle.scentTags) {
    const allergyMatch = candle.scentTags.filter(tag => allAllergyTags.includes(tag));
    if (allergyMatch.length > 0) {
      return {
        score: -1000,
        reasons: [],
        allergyWarning: {
          hasAllergy: true,
          conflictingTags: allergyMatch,
          message: `含有过敏成分: ${allergyMatch.join(', ')}，不适合作为礼物`
        }
      };
    }

    const excludeMatch = candle.scentTags.filter(tag => allExcludeTags.includes(tag));
    if (excludeMatch.length > 0) {
      return {
        score: -500,
        reasons: [],
        excludeWarning: {
          hasExclude: true,
          conflictingTags: excludeMatch,
          message: `含有排斥成分: ${excludeMatch.join(', ')}，不适合作为礼物`
        }
      };
    }
  }

  let score = 0;
  const reasons = [];
  const tabooAvoided = [];
  const matchedPreferences = [];

  if (recipient.relationship) {
    const relType = storage.getRelationshipTypeByCode(recipient.relationship);
    if (relType) {
      score += 15;
      reasons.push(`关系匹配: ${relType.name}`);
      matchedPreferences.push('relationship');

      if (theme && theme === relType.defaultTheme) {
        score += 10;
        reasons.push(`关系主题匹配: ${theme}`);
      }
    }
  }

  if (recipient.ageGroup) {
    const ageBoosts = {
      child: { fresh: 8, fruity: 8, gourmand: 6 },
      teen: { fresh: 6, citrus: 8, fruity: 6 },
      young_adult: { floral: 8, fresh: 6, citrus: 6 },
      adult: { floral: 6, woody: 8, oriental: 6 },
      middle_aged: { woody: 10, gourmet: 6, herbal: 6 },
      senior: { herbal: 8, woody: 8, floral: 6 }
    };

    const boosts = ageBoosts[recipient.ageGroup] || {};
    if (candle.fragranceCategory && boosts[candle.fragranceCategory]) {
      score += boosts[candle.fragranceCategory];
      reasons.push(`年龄段偏好匹配: ${recipient.ageGroup} - ${candle.fragranceCategory}`);
      matchedPreferences.push('ageGroup');
    }
  }

  if (recipient.preferredScents && recipient.preferredScents.length > 0 && candle.scentTags) {
    const scentMatches = candle.scentTags.filter(tag => recipient.preferredScents.includes(tag));
    if (scentMatches.length > 0) {
      score += scentMatches.length * 12;
      reasons.push(`香调偏好匹配: ${scentMatches.join(', ')}`);
      matchedPreferences.push('preferredScents');
    }
  }

  if (recipient.intensityPreference && candle.intensity) {
    if (recipient.intensityPreference === candle.intensity) {
      score += 8;
      reasons.push(`浓度偏好匹配: ${candle.intensity}`);
      matchedPreferences.push('intensityPreference');
    }
  }

  const currentSeason = season || storage.getCurrentSeason();
  const seasonMapping = storage.getSeasonFragranceMapping(currentSeason);
  const seasonMatch = seasonMapping.find(m => m.category === candle.fragranceCategory);
  if (seasonMatch) {
    score += seasonMatch.weight * 10;
    const seasonPref = storage.getSeasonPreferenceByCode(currentSeason);
    reasons.push(`季节匹配: ${seasonPref?.name || currentSeason} - ${seasonMatch.reason}`);
    matchedPreferences.push('season');
  }

  if (occasion) {
    const holiday = storage.getHolidayByCode(occasion);
    if (holiday && holiday.suggestedFragrances) {
      if (holiday.suggestedFragrances.includes(candle.fragranceCategory)) {
        score += 15;
        reasons.push(`节日匹配: ${holiday.name}`);
        matchedPreferences.push('occasion');
      }
    }
  }

  if (theme) {
    const boxTheme = storage.getGiftBoxThemeByCode(theme);
    if (boxTheme && boxTheme.suggestedFragrances) {
      if (boxTheme.suggestedFragrances.includes(candle.fragranceCategory)) {
        score += 12;
        reasons.push(`礼盒主题匹配: ${boxTheme.name}`);
        matchedPreferences.push('theme');
      }
    }
  }

  if (recipient.relationship) {
    const relType = storage.getRelationshipTypeByCode(recipient.relationship);
    if (relType && relType.defaultTheme) {
      const defaultTheme = storage.getGiftBoxThemeByCode(relType.defaultTheme);
      if (defaultTheme && defaultTheme.suggestedFragrances && defaultTheme.suggestedFragrances.includes(candle.fragranceCategory)) {
        score += 5;
        reasons.push(`关系默认主题匹配: ${defaultTheme.name}`);
      }
    }
  }

  if (candle.price) {
    if (recipient.minBudget && recipient.maxBudget) {
      const midBudget = (recipient.minBudget + recipient.maxBudget) / 2;
      if (candle.price >= recipient.minBudget && candle.price <= recipient.maxBudget) {
        const priceDistance = Math.abs(candle.price - midBudget) / (recipient.maxBudget - recipient.minBudget);
        const priceScore = (1 - priceDistance) * 10;
        score += priceScore;
        reasons.push(`预算匹配: ¥${candle.price} 在预算范围内`);
        matchedPreferences.push('budget');
      }
    } else if (recipient.maxBudget && candle.price <= recipient.maxBudget) {
      score += 5;
      reasons.push(`价格合理: ¥${candle.price} 不超过最高预算`);
    }
  }

  if (allAllergyTags.length > 0 && candle.scentTags) {
    const avoided = allAllergyTags.filter(tag => !candle.scentTags.includes(tag));
    if (avoided.length > 0) {
      tabooAvoided.push(`已规避过敏成分: ${avoided.join(', ')}`);
    }
  }

  if (allExcludeTags.length > 0 && candle.scentTags) {
    const avoided = allExcludeTags.filter(tag => !candle.scentTags.includes(tag));
    if (avoided.length > 0) {
      tabooAvoided.push(`已规避排斥成分: ${avoided.join(', ')}`);
    }
  }

  return {
    score: Number(score.toFixed(1)),
    reasons,
    matchedPreferences,
    tabooAvoided,
    price: candle.price,
    allergyWarning: null,
    excludeWarning: null
  };
}

function getAvailableStock(userId) {
  const uid = userId ? normalizeUserId(userId) : DEFAULT_USER_ID;
  const inventory = storage.getAvailableInventoryCandles(uid);
  return inventory.filter(item => item.quantity > 0);
}

function determineTheme(recipient, occasion) {
  if (recipient.preferredTheme) {
    return recipient.preferredTheme;
  }

  if (occasion) {
    const holiday = storage.getHolidayByCode(occasion);
    if (holiday) {
      return holiday.theme;
    }
  }

  if (recipient.relationship) {
    const relType = storage.getRelationshipTypeByCode(recipient.relationship);
    if (relType) {
      return relType.defaultTheme;
    }
  }

  return 'warmth';
}

function generatePackagingSuggestion(recipient, theme, totalPrice) {
  const packagingCode = recipient.packagingPreference || 'gift';
  const packaging = storage.getPackagingPreferenceByCode(packagingCode);

  if (!packaging) {
    return {
      code: 'gift',
      name: '精美礼盒',
      description: '精装礼盒，丝带装饰',
      extraCost: 20,
      suggestion: '推荐使用精美礼盒包装'
    };
  }

  let suggestion = `推荐使用${packaging.name}包装`;

  if (theme) {
    const boxTheme = storage.getGiftBoxThemeByCode(theme);
    if (boxTheme) {
      suggestion += `，搭配${boxTheme.name}主题装饰`;
    }
  }

  if (totalPrice >= 300) {
    suggestion += '，建议附赠精美贺卡';
  }

  if (totalPrice >= 600) {
    suggestion += '，可提供定制刻字服务';
  }

  return {
    code: packaging.code,
    name: packaging.name,
    description: packaging.description,
    extraCost: packaging.extraCost,
    suggestion
  };
}

function generateGiftBoxRecommendation(userId, options = {}) {
  const uid = userId ? normalizeUserId(userId) : DEFAULT_USER_ID;
  const {
    recipientProfileId,
    maxCandles = 3,
    season,
    occasion,
    theme: explicitTheme,
    packagingPreference
  } = options;

  const recipient = getRecipientPreferences(recipientProfileId, uid, options);

  if (!recipient) {
    return {
      status: 'recipient_not_found',
      message: '未找到指定的收礼人档案',
      recommendations: []
    };
  }

  if (recipientProfileId === undefined && !recipient.relationship && !recipient.ageGroup && !recipient.preferredScents?.length) {
    return {
      status: 'insufficient_data',
      message: '请提供收礼人档案ID，或至少提供关系类型、年龄段、偏好香调中的一项',
      recommendations: []
    };
  }

  const theme = explicitTheme || determineTheme(recipient, occasion);
  const allCandles = storage.getAllCandles();
  const availableStock = getAvailableStock(uid);
  const stockMap = new Map();

  availableStock.forEach(item => {
    const key = `${item.brand}-${item.capacity}`;
    stockMap.set(key, item.quantity);
  });

  const scoredCandles = allCandles
    .filter(c => c.fragranceCategory)
    .map(candle => {
      const giftScore = calculateGiftMatchScore(candle, recipient, {
        season,
        occasion,
        theme,
        userId: uid
      });

      const stockKey = `${candle.brand}-${candle.capacity}`;
      const inStock = stockMap.has(stockKey);
      const stockQuantity = stockMap.get(stockKey) || 0;

      return {
        candle: {
          id: candle.id,
          brand: candle.brand,
          name: candle.name,
          fragranceCategory: candle.fragranceCategory,
          scentTags: candle.scentTags,
          intensity: candle.intensity,
          capacity: candle.capacity,
          unit: candle.unit,
          price: candle.price
        },
        ...giftScore,
        inStock,
        stockQuantity
      };
    });

  const validCandles = scoredCandles.filter(s => s.score > 0);

  if (validCandles.length === 0) {
    const allergyCount = scoredCandles.filter(s => s.allergyWarning).length;
    const excludeCount = scoredCandles.filter(s => s.excludeWarning).length;
    const tabooAvoided = [];

    const allAllergies = [...(recipient.allergyTags || [])];
    const allExcludes = [...(recipient.excludeTags || [])];

    if (allAllergies.length > 0) {
      tabooAvoided.push(`已规避过敏成分: ${allAllergies.join(', ')}`);
    }
    if (allExcludes.length > 0) {
      tabooAvoided.push(`已规避排斥成分: ${allExcludes.join(', ')}`);
    }

    return {
      status: 'no_matching',
      message: '当前库存中没有符合所有条件的礼盒组合',
      matchScore: 0,
      estimatedTotal: 0,
      budgetUsed: 0,
      needsRestock: false,
      tabooAvoided,
      packagingSuggestion: null,
      reasons: [`${allergyCount} 款因过敏成分排除，${excludeCount} 款因排斥成分排除`],
      recommendations: []
    };
  }

  validCandles.sort((a, b) => b.score - a.score);

  const maxResults = Math.min(maxCandles, validCandles.length);
  const selected = validCandles.slice(0, maxResults);

  const conflicts = detectScentConflicts(selected.map(r => r.candle));

  const totalPrice = selected.reduce((sum, s) => sum + s.candle.price, 0);
  const inStockCount = selected.filter(s => s.inStock).length;
  const needsRestock = inStockCount < selected.length;

  let budgetUsed = 0;
  let budgetStatus = 'within_budget';

  if (recipient.maxBudget) {
    budgetUsed = Number(((totalPrice / recipient.maxBudget) * 100).toFixed(1));
    if (totalPrice > recipient.maxBudget) {
      budgetStatus = 'over_budget';
    } else if (budgetUsed >= 80) {
      budgetStatus = 'near_budget_limit';
    }
  } else if (recipient.minBudget) {
    if (totalPrice >= recipient.minBudget) {
      budgetStatus = 'above_min_budget';
    }
  }

  const averageMatchScore = selected.length > 0
    ? Number((selected.reduce((sum, s) => sum + s.score, 0) / selected.length).toFixed(1))
    : 0;

  const allTabooAvoided = [...new Set(selected.flatMap(s => s.tabooAvoided || []))];

  const packagingSuggestion = generatePackagingSuggestion(
    { ...recipient, packagingPreference },
    theme,
    totalPrice
  );

  const finalTotal = totalPrice + packagingSuggestion.extraCost;

  const outOfStockItems = selected.filter(s => !s.inStock).map(s => ({
    candle: s.candle,
    reason: '当前库存不足，需要补货',
    suggestedQuantity: 1
  }));

  const restockInfo = needsRestock ? {
    needsRestock: true,
    outOfStockItems,
    restockEstimatedCost: outOfStockItems.reduce((sum, item) => sum + item.candle.price, 0),
    message: `${selected.length - inStockCount}/${selected.length} 款需要补货`
  } : {
    needsRestock: false,
    message: '所有推荐均有库存，可直接发货'
  };

  const themeInfo = storage.getGiftBoxThemeByCode(theme);
  const occasionInfo = occasion ? storage.getHolidayByCode(occasion) : null;
  const seasonInfo = storage.getSeasonPreferenceByCode(season || storage.getCurrentSeason());

  const result = {
    status: 'success',
    userId: uid,
    recipientProfileId: recipientProfileId || null,
    matchScore: averageMatchScore,
    maxMatchScore: Math.max(...selected.map(s => s.score)),
    estimatedTotal: Number(totalPrice.toFixed(2)),
    finalTotalWithPackaging: Number(finalTotal.toFixed(2)),
    budgetUsed,
    budgetStatus,
    budgetRange: recipient.minBudget || recipient.maxBudget ? {
      min: recipient.minBudget || null,
      max: recipient.maxBudget || null
    } : null,
    ...restockInfo,
    tabooAvoided: allTabooAvoided,
    packagingSuggestion,
    queryContext: {
      theme: themeInfo ? { code: themeInfo.code, name: themeInfo.name, color: themeInfo.color } : null,
      occasion: occasionInfo ? { code: occasionInfo.code, name: occasionInfo.name } : null,
      season: seasonInfo ? { code: seasonInfo.code, name: seasonInfo.name } : null,
      relationship: recipient.relationship ? {
        code: recipient.relationship,
        name: storage.getRelationshipTypeByCode(recipient.relationship)?.name
      } : null,
      ageGroup: recipient.ageGroup
    },
    conflictWarnings: conflicts,
    allergyWarnings: selected.filter(s => s.allergyWarning).map(s => ({
      candle: s.candle,
      ...s.allergyWarning
    })),
    excludeWarnings: selected.filter(s => s.excludeWarning).map(s => ({
      candle: s.candle,
      ...s.excludeWarning
    })),
    recommendations: selected.map((r, index) => ({
      rank: index + 1,
      matchScore: r.score,
      candle: r.candle,
      reasons: r.reasons,
      matchedPreferences: r.matchedPreferences,
      inStock: r.inStock,
      stockQuantity: r.stockQuantity
    })),
    giftMessage: generateGiftMessage(recipient, { occasion, theme, candleIds: selected.map(s => s.candle.id) }),
    lastUpdated: Date.now()
  };

  storage.saveGiftBoxRecommendation({
    recipientProfileId,
    type: 'single',
    matchScore: averageMatchScore,
    estimatedTotal: totalPrice,
    candleIds: selected.map(s => s.candle.id)
  }, uid);

  return result;
}

function generateSubscriptionPlan(userId, options = {}) {
  const uid = userId ? normalizeUserId(userId) : DEFAULT_USER_ID;
  const {
    recipientProfileId,
    cycle = 'monthly',
    months = 3,
    startDate,
    preferredTheme,
    packagingPreference,
    minBudget,
    maxBudget
  } = options;

  const recipient = getRecipientPreferences(recipientProfileId, uid, options);

  if (!recipient) {
    return {
      status: 'recipient_not_found',
      message: '未找到指定的收礼人档案',
      plan: []
    };
  }

  const cycleInfo = storage.getSubscriptionCycleByCode(cycle);
  if (!cycleInfo) {
    return {
      status: 'invalid_cycle',
      message: '无效的订阅周期',
      validCycles: storage.getSubscriptionCycles().map(c => ({ code: c.code, name: c.name })),
      plan: []
    };
  }

  const actualMinBudget = minBudget || recipient.minBudget || 150;
  const actualMaxBudget = maxBudget || recipient.maxBudget || 600;
  const perBoxBudget = actualMaxBudget / cycleInfo.durationMonths;

  const plan = [];
  const themes = ['romance', 'warmth', 'fresh', 'relax', 'elegant', 'birthday', 'friendship'];
  const seasons = ['spring', 'summer', 'autumn', 'winter'];

  const start = startDate ? new Date(startDate) : new Date();
  const cycleMonths = cycleInfo.durationMonths;

  for (let i = 0; i < months; i++) {
    const deliveryDate = new Date(start);
    deliveryDate.setMonth(deliveryDate.getMonth() + i * cycleMonths);

    const monthIndex = deliveryDate.getMonth();
    const seasonIndex = Math.floor(monthIndex / 3) % 4;
    const currentSeason = seasons[seasonIndex];

    const upcomingHolidays = storage.getHolidaysByMonth(monthIndex + 1);
    let occasion = null;
    if (upcomingHolidays.length > 0) {
      occasion = upcomingHolidays[0].code;
    }

    const themeIndex = i % themes.length;
    const theme = preferredTheme || themes[themeIndex];

    const boxResult = generateGiftBoxRecommendation(uid, {
      recipientProfileId,
      maxCandles: 2,
      season: currentSeason,
      occasion,
      theme,
      packagingPreference,
      minBudget: Math.max(50, perBoxBudget * 0.8),
      maxBudget: perBoxBudget * 1.2,
      relationship: recipient.relationship,
      ageGroup: recipient.ageGroup,
      preferredScents: recipient.preferredScents,
      allergyTags: recipient.allergyTags,
      excludeTags: recipient.excludeTags,
      intensityPreference: recipient.intensityPreference
    });

    if (boxResult.status === 'success') {
      plan.push({
        period: i + 1,
        deliveryDate: deliveryDate.toISOString().split('T')[0],
        season: currentSeason,
        theme,
        occasion,
        recommendation: boxResult,
        periodPrice: Number((boxResult.estimatedTotal * cycleInfo.discount).toFixed(2))
      });
    } else {
      plan.push({
        period: i + 1,
        deliveryDate: deliveryDate.toISOString().split('T')[0],
        season: currentSeason,
        theme,
        occasion,
        recommendation: null,
        error: boxResult.message
      });
    }
  }

  const totalOriginalPrice = plan
    .filter(p => p.recommendation)
    .reduce((sum, p) => sum + p.recommendation.estimatedTotal, 0);

  const totalDiscountedPrice = plan
    .filter(p => p.periodPrice)
    .reduce((sum, p) => sum + p.periodPrice, 0);

  const savings = Number((totalOriginalPrice - totalDiscountedPrice).toFixed(2));

  const successfulBoxes = plan.filter(p => p.recommendation).length;

  return {
    status: successfulBoxes > 0 ? 'success' : 'no_matching',
    userId: uid,
    recipientProfileId,
    cycle: {
      code: cycleInfo.code,
      name: cycleInfo.name,
      durationMonths: cycleInfo.durationMonths,
      discount: cycleInfo.discount,
      description: cycleInfo.description
    },
    totalMonths: months,
    totalBoxes: successfulBoxes,
    totalOriginalPrice: Number(totalOriginalPrice.toFixed(2)),
    totalDiscountedPrice: Number(totalDiscountedPrice.toFixed(2)),
    savings,
    savingsPercentage: totalOriginalPrice > 0 ? Number((savings / totalOriginalPrice * 100).toFixed(1)) : 0,
    budgetRange: {
      min: actualMinBudget,
      max: actualMaxBudget,
      perBoxBudget: Number(perBoxBudget.toFixed(2))
    },
    plan,
    lastUpdated: Date.now()
  };
}

function generateBudgetCombinations(userId, options = {}) {
  const uid = userId ? normalizeUserId(userId) : DEFAULT_USER_ID;
  const {
    minBudget = 50,
    maxBudget = 500,
    maxCombinations = 10,
    recipientProfileId
  } = options;

  const recipient = recipientProfileId
    ? getRecipientPreferences(recipientProfileId, uid, options)
    : getRecipientPreferences(null, uid, options);

  const allCandles = storage.getAllCandles().filter(c => c.price);
  const availableStock = getAvailableStock(uid);
  const stockMap = new Map();

  availableStock.forEach(item => {
    const key = `${item.brand}-${item.capacity}`;
    stockMap.set(key, item.quantity);
  });

  const validCandles = allCandles
    .filter(c => c.price >= minBudget * 0.3 && c.price <= maxBudget)
    .map(candle => {
      const giftScore = recipient
        ? calculateGiftMatchScore(candle, recipient, { userId: uid })
        : { score: 50, reasons: ['基础推荐'], matchedPreferences: [] };

      const stockKey = `${candle.brand}-${candle.capacity}`;
      return {
        candle: {
          id: candle.id,
          brand: candle.brand,
          name: candle.name,
          fragranceCategory: candle.fragranceCategory,
          scentTags: candle.scentTags,
          price: candle.price
        },
        score: giftScore.score,
        reasons: giftScore.reasons,
        inStock: stockMap.has(stockKey),
        stockQuantity: stockMap.get(stockKey) || 0,
        allergyWarning: giftScore.allergyWarning,
        excludeWarning: giftScore.excludeWarning
      };
    })
    .filter(c => c.score > 0 && !c.allergyWarning && !c.excludeWarning)
    .sort((a, b) => b.score - a.score);

  if (validCandles.length === 0) {
    return {
      status: 'no_matching',
      message: '没有在预算范围内且符合条件的商品',
      budgetRange: { min: minBudget, max: maxBudget },
      combinations: []
    };
  }

  const combinations = [];

  for (let size = 1; size <= Math.min(5, validCandles.length); size++) {
    const sizeCombinations = generateCombinations(validCandles, size, minBudget, maxBudget);
    combinations.push(...sizeCombinations);
  }

  combinations.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    const aBudgetFit = Math.abs((a.totalPrice - minBudget) / (maxBudget - minBudget));
    const bBudgetFit = Math.abs((b.totalPrice - minBudget) / (maxBudget - minBudget));
    return aBudgetFit - bBudgetFit;
  });

  const finalCombinations = combinations.slice(0, maxCombinations).map((combo, index) => {
    const inStockCount = combo.items.filter(i => i.inStock).length;
    const needsRestock = inStockCount < combo.items.length;
    const packaging = generatePackagingSuggestion(recipient || {}, null, combo.totalPrice);

    return {
      rank: index + 1,
      matchScore: combo.matchScore,
      totalPrice: combo.totalPrice,
      finalPrice: Number((combo.totalPrice + packaging.extraCost).toFixed(2)),
      budgetFit: Number(((combo.totalPrice - minBudget) / (maxBudget - minBudget) * 100).toFixed(1)),
      needsRestock,
      packagingSuggestion: packaging,
      items: combo.items.map((item, idx) => ({
        rank: idx + 1,
        matchScore: item.score,
        candle: item.candle,
        reasons: item.reasons,
        inStock: item.inStock,
        stockQuantity: item.stockQuantity
      })),
      tabooAvoided: recipient ? [...new Set(combo.items.flatMap(i => {
        const score = calculateGiftMatchScore(storage.getCandleById(i.candle.id), recipient, { userId: uid });
        return score.tabooAvoided || [];
      }))] : []
    };
  });

  const restockNeeded = finalCombinations.some(c => c.needsRestock);

  return {
    status: 'success',
    userId: uid,
    recipientProfileId: recipientProfileId || null,
    budgetRange: { min: minBudget, max: maxBudget },
    totalCombinationsFound: combinations.length,
    totalCombinationsReturned: finalCombinations.length,
    needsRestock: restockNeeded,
    combinations: finalCombinations,
    lastUpdated: Date.now()
  };
}

function generateCombinations(items, size, minBudget, maxBudget) {
  const result = [];
  const n = items.length;

  function backtrack(start, current, currentPrice, currentScore) {
    if (current.length === size) {
      if (currentPrice >= minBudget && currentPrice <= maxBudget) {
        result.push({
          items: [...current],
          totalPrice: Number(currentPrice.toFixed(2)),
          matchScore: Number((currentScore / size).toFixed(1))
        });
      }
      return;
    }

    if (start >= n) return;

    for (let i = start; i < n; i++) {
      const item = items[i];
      const newPrice = currentPrice + item.candle.price;
      if (newPrice > maxBudget) continue;

      current.push(item);
      backtrack(i + 1, current, newPrice, currentScore + item.score);
      current.pop();
    }
  }

  backtrack(0, [], 0, 0);
  return result;
}

function generateStockAlternatives(userId, options = {}) {
  const uid = userId ? normalizeUserId(userId) : DEFAULT_USER_ID;
  const { candleIds, recipientProfileId } = options;

  const recipient = recipientProfileId
    ? getRecipientPreferences(recipientProfileId, uid, options)
    : getRecipientPreferences(null, uid, options);

  const outOfStockCandles = [];
  const availableStock = getAvailableStock(uid);
  const stockMap = new Map();

  availableStock.forEach(item => {
    const key = `${item.brand}-${item.capacity}`;
    stockMap.set(key, item.quantity);
  });

  for (const cid of candleIds) {
    const candle = storage.getCandleById(cid);
    if (!candle) continue;

    const stockKey = `${candle.brand}-${candle.capacity}`;
    const quantity = stockMap.get(stockKey) || 0;

    if (quantity === 0) {
      outOfStockCandles.push({
        candle: {
          id: candle.id,
          brand: candle.brand,
          name: candle.name,
          fragranceCategory: candle.fragranceCategory,
          scentTags: candle.scentTags,
          price: candle.price
        },
        reason: '当前库存为0'
      });
    }
  }

  if (outOfStockCandles.length === 0) {
    return {
      status: 'all_in_stock',
      message: '所有商品均有库存，无需替代',
      alternatives: []
    };
  }

  const alternatives = [];

  for (const outOfStock of outOfStockCandles) {
    const originalCandle = outOfStock.candle;
    const category = originalCandle.fragranceCategory;
    const price = originalCandle.price;

    const similarCandles = storage.getAllCandles()
      .filter(c => c.id !== originalCandle.id)
      .map(c => {
        const giftScore = recipient
          ? calculateGiftMatchScore(c, recipient, { userId: uid })
          : { score: 50, reasons: [], matchedPreferences: [] };

        const stockKey = `${c.brand}-${c.capacity}`;
        const inStock = stockMap.has(stockKey);
        const stockQuantity = stockMap.get(stockKey) || 0;

        let similarity = 0;
        if (c.fragranceCategory === category) similarity += 30;
        if (c.scentTags && originalCandle.scentTags) {
          const tagMatches = c.scentTags.filter(t => originalCandle.scentTags.includes(t));
          similarity += tagMatches.length * 15;
        }
        if (c.intensity === originalCandle.intensity) similarity += 10;
        const priceDiff = Math.abs(c.price - price);
        if (priceDiff <= price * 0.1) similarity += 20;
        else if (priceDiff <= price * 0.2) similarity += 10;

        return {
          candle: {
            id: c.id,
            brand: c.brand,
            name: c.name,
            fragranceCategory: c.fragranceCategory,
            scentTags: c.scentTags,
            intensity: c.intensity,
            price: c.price
          },
          similarity: Number(similarity.toFixed(1)),
          matchScore: giftScore.score,
          priceDifference: Number((c.price - price).toFixed(2)),
          reasons: giftScore.reasons,
          inStock,
          stockQuantity,
          allergyWarning: giftScore.allergyWarning,
          excludeWarning: giftScore.excludeWarning
        };
      })
      .filter(c => c.inStock && c.stockQuantity > 0 && !c.allergyWarning && !c.excludeWarning)
      .sort((a, b) => {
        if (b.similarity !== a.similarity) return b.similarity - a.similarity;
        return b.matchScore - a.matchScore;
      })
      .slice(0, 3);

    alternatives.push({
      original: outOfStock,
      alternatives: similarCandles.map(a => ({
        ...a,
        recommendation: a.similarity >= 60
          ? '高度相似，推荐作为替代'
          : a.similarity >= 40
            ? '较为相似，可考虑替代'
            : '部分相似，作为备选'
      })),
      hasSuitableAlternative: similarCandles.length > 0 && similarCandles[0].similarity >= 40
    });
  }

  const allHaveAlternatives = alternatives.every(a => a.hasSuitableAlternative);

  return {
    status: allHaveAlternatives ? 'alternatives_found' : 'partial_alternatives',
    message: allHaveAlternatives
      ? '已为所有缺货商品找到合适替代'
      : '部分缺货商品未找到理想替代',
    userId: uid,
    recipientProfileId: recipientProfileId || null,
    outOfStockCount: outOfStockCandles.length,
    alternativesFoundCount: alternatives.filter(a => a.hasSuitableAlternative).length,
    alternatives,
    lastUpdated: Date.now()
  };
}

const GIFT_MESSAGE_TEMPLATES = {
  warm: {
    greeting: ['亲爱的', '亲爱的', '最亲爱的'],
    body: [
      '愿这缕馨香，如我对你的思念，时时萦绕你身旁。',
      '每一次点燃，都是我对你的祝福，愿你被温柔以待。',
      '希望这份香气能给你带来片刻的宁静与美好。',
      '在这个特别的日子里，愿温暖与芬芳常伴你左右。'
    ],
    closing: ['永远爱你的', '想念你的', '祝福你的', '诚挚的']
  },
  romantic: {
    greeting: ['我最爱的', '亲爱的', '我的挚爱'],
    body: [
      '你是我生命中最美的风景，愿这香气如我对你的爱，永不消散。',
      '与你在一起的每一天，都如这芬芳般令人沉醉。',
      '愿这缕馨香，替我诉说那些说不尽的爱意。',
      '你是我最珍贵的礼物，愿这份香气伴你度过每一个美好时刻。'
    ],
    closing: ['永远爱你的', '你的专属', '爱你的', '想你的']
  },
  formal: {
    greeting: ['尊敬的', '敬爱的', '亲爱的'],
    body: [
      '谨以此薄礼，表达我最诚挚的祝福与感谢。',
      '感谢您一直以来的关照，愿这份香气为您带来舒心与愉悦。',
      '在这个特别的日子里，祝您生活如这芬芳般美好。',
      '小小礼物，不成敬意，愿您喜欢这份独特的香气。'
    ],
    closing: ['敬上', '诚挚的', '衷心祝福的', '您的朋友']
  },
  casual: {
    greeting: ['嗨', '嘿', '亲爱的朋友'],
    body: [
      '给你准备了一份小惊喜，希望你喜欢这个味道！',
      '知道你喜欢香薰，特意挑了这款，试试看！',
      '生日快乐！愿你的生活也如这香气般美好。',
      '送你一份好心情，点燃它，让烦恼都烟消云散~'
    ],
    closing: ['你的朋友', '么么哒', '爱你哟', '干杯！']
  },
  humorous: {
    greeting: ['喂，那个谁', '哈哈，是我', '亲爱的冤种朋友'],
    body: [
      '不用谢，我知道你又要感动得哭了。不用谢~',
      '警告：此蜡烛点燃后可能导致极度舒适，请勿沉迷！',
      '给你买的，别问多少钱，问就是你欠我一顿饭。',
      '看你最近太累了，给你加个「香薰buff」，打怪升级去吧！'
    ],
    closing: ['你最亲爱的', '比心', '就不告诉你是谁', '哈哈哈']
  },
  touching: {
    greeting: ['我最想感谢的人', '一直在我心里的你', '亲爱的'],
    body: [
      '有些话一直想对你说：谢谢你，出现在我的生命里。',
      '愿这缕香气，能替我陪伴你那些我不在身边的时刻。',
      '你值得世间所有的美好，这只是小小的开始。',
      '无论时光如何流转，你永远是我最珍贵的人。'
    ],
    closing: ['永远感恩的', '永远记得你的', '爱你的', '想你的']
  }
};

const OCCASION_ADDONS = {
  birthday: ['生日快乐！', '愿你新的一岁，如这芬芳般绚烂。', '祝你岁岁平安，年年有今日~'],
  valentines: ['情人节快乐！', '愿我们的爱情如这香气般历久弥新。', '有你在身边，每天都是情人节。'],
  anniversary: ['纪念日快乐！', '感谢有你相伴的每一个日子。', '愿我们的故事，如这香气般悠长。'],
  mothers_day: ['母亲节快乐！', '妈妈，您辛苦了，我爱您。', '愿您永远年轻美丽，芬芳常伴。'],
  fathers_day: ['父亲节快乐！', '爸爸，感谢您无言的付出与守护。', '您是我永远的榜样和依靠。'],
  christmas: ['圣诞快乐！', '愿这个圣诞，温暖与芬芳与你同在。', 'Merry Christmas！'],
  new_year: ['新年快乐！', '愿新的一年，美好与芬芳常伴你左右。', '祝你新年新气象，万事顺遂！'],
  spring_festival: ['春节快乐！', '新年大吉，万事如意！', '愿新岁有新喜，芬芳满庭芳。'],
  mid_autumn: ['中秋节快乐！', '月圆人团圆，情谊永相连。', '但愿人长久，千里共婵娟。'],
  teachers_day: ['教师节快乐！', '师恩难忘，谢谢您的辛勤付出。', '您的教诲如明灯，照亮我前行的路。'],
  graduation: ['毕业快乐！', '愿你前程似锦，未来可期。', '新的旅程，愿芬芳常伴你左右。'],
  housewarming: ['乔迁之喜！', '恭喜搬新家，愿新居满是芬芳与美好。', '开启新生活，从一缕馨香开始。'],
  wedding: ['新婚快乐！', '愿你们的爱情如这香气般甜蜜持久。', '百年好合，永结同心！'],
  baby_shower: ['恭喜新生命的到来！', '愿小天使健康快乐成长。', '新手爸妈辛苦了，记得也要爱自己~'],
  thank_you: ['谢谢你！', '千言万语，化作这一缕馨香。', '感谢有你，温暖了我的时光。'],
  get_well: ['早日康复！', '愿这芬芳为你带来好心情，快快好起来。', '愿温暖与健康常伴你。'],
  just_because: ['没有什么特别的理由，就是想你了。', '看到它，就想起了你。', '给平淡的日子，添一抹芬芳。']
};

function generateGiftMessage(recipient, options = {}) {
  const { occasion, theme, tone = 'warm', candleIds = [] } = options;

  const templates = GIFT_MESSAGE_TEMPLATES[tone] || GIFT_MESSAGE_TEMPLATES.warm;
  const greeting = templates.greeting[Math.floor(Math.random() * templates.greeting.length)];
  const body = templates.body[Math.floor(Math.random() * templates.body.length)];
  const closing = templates.closing[Math.floor(Math.random() * templates.closing.length)];

  let occasionAddon = '';
  if (occasion && OCCASION_ADDONS[occasion]) {
    const addons = OCCASION_ADDONS[occasion];
    occasionAddon = addons[Math.floor(Math.random() * addons.length)] + '\n\n';
  }

  let recipientName = recipient.name || '朋友';

  let candleNote = '';
  if (candleIds.length > 0) {
    const candles = candleIds.map(id => storage.getCandleById(id)).filter(Boolean);
    if (candles.length > 0) {
      const scents = [...new Set(candles.flatMap(c => c.scentTags || []))].slice(0, 3);
      if (scents.length > 0) {
        candleNote = `\n\n礼盒包含${candles.length}款精选香薰：${scents.join('、')}等多种香调。`;
      }
    }
  }

  const message = `${greeting}${recipientName}：\n\n${occasionAddon}${body}${candleNote}\n\n${closing}\n— 送礼人`;

  return {
    tone,
    occasion,
    theme,
    message,
    shortMessage: `${greeting}${recipientName}，${occasionAddon.split('\n')[0] || body.split('。')[0]}`,
    suggestions: [
      `推荐使用「${tone}」语气的文案，适合${recipient.relationship || '送礼'}场合`,
      occasion ? `可加入${occasion}节日祝福` : '可根据具体场合调整祝福语',
      '建议手写贺卡，更显心意'
    ]
  };
}

module.exports = {
  getRecipientPreferences,
  calculateGiftMatchScore,
  generateGiftBoxRecommendation,
  generateSubscriptionPlan,
  generateBudgetCombinations,
  generateStockAlternatives,
  generateGiftMessage,
  generatePackagingSuggestion,
  determineTheme
};
