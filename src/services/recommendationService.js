const { storage, normalizeUserId } = require('../storage/memoryStorage');

function calculateCandleScore(candle, userId, options = {}) {
  const { scene, mood, season, preferences, ratings, availableInventory } = options;

  let score = 0;
  const reasons = [];

  const userPreferences = preferences || storage.getUserScentPreferences(userId);
  const userRatings = ratings || storage.getUserRatings({ userId });
  const inventory = availableInventory || storage.getAvailableInventoryCandles(userId);

  if (userPreferences?.allergyTags && candle.scentTags) {
    const allergyMatch = candle.scentTags.filter(tag => userPreferences.allergyTags.includes(tag));
    if (allergyMatch.length > 0) {
      return {
        score: -1000,
        reasons: [],
        allergyWarning: {
          hasAllergy: true,
          conflictingTags: allergyMatch,
          message: `含有过敏成分: ${allergyMatch.join(', ')}，不推荐使用`
        }
      };
    }
  }

  if (userPreferences?.excludeTags && candle.scentTags) {
    const excludeMatch = candle.scentTags.filter(tag => userPreferences.excludeTags.includes(tag));
    if (excludeMatch.length > 0) {
      return {
        score: -500,
        reasons: [],
        excludeWarning: {
          hasExclude: true,
          conflictingTags: excludeMatch,
          message: `含有排斥成分: ${excludeMatch.join(', ')}，不推荐使用`
        }
      };
    }
  }

  const categoryScores = calculateCategoryPreferenceScores(userId, userPreferences, userRatings);

  if (candle.fragranceCategory && categoryScores[candle.fragranceCategory]) {
    const categoryScore = categoryScores[candle.fragranceCategory];
    score += categoryScore * 30;
    const category = storage.getFragranceCategoryByCode(candle.fragranceCategory);
    reasons.push(`香调偏好匹配: ${category?.name || candle.fragranceCategory} (${categoryScore.toFixed(1)}分)`);
  }

  if (scene) {
    const sceneMapping = storage.getSceneFragranceMapping(scene);
    const sceneMatch = sceneMapping.find(m => m.category === candle.fragranceCategory);
    if (sceneMatch) {
      score += sceneMatch.weight * 25;
      const scenario = storage.getUsageScenarioByCode(scene);
      reasons.push(`场景匹配: ${scenario?.name || scene} - ${sceneMatch.reason}`);
    } else {
      const validScenes = [...new Set(storage.sceneFragranceMapping.map(m => m.scene))];
      if (!validScenes.includes(scene)) {
        return {
          score: -1,
          reasons: [],
          sceneError: `未知场景: ${scene}，有效值为: ${validScenes.join(', ')}`
        };
      }
    }
  }

  if (mood) {
    const moodMapping = storage.getMoodFragranceMapping(mood);
    const moodMatch = moodMapping.find(m => m.category === candle.fragranceCategory);
    if (moodMatch) {
      score += moodMatch.weight * 25;
      const moodGoal = storage.getMoodGoalByCode(mood);
      reasons.push(`情绪目标匹配: ${moodGoal?.name || mood} - ${moodMatch.reason}`);
    } else {
      const validMoods = [...new Set(storage.moodFragranceMapping.map(m => m.mood))];
      if (!validMoods.includes(mood)) {
        return {
          score: -1,
          reasons: [],
          moodError: `未知情绪目标: ${mood}，有效值为: ${validMoods.join(', ')}`
        };
      }
    }
  }

  if (season) {
    const seasonMapping = storage.getSeasonFragranceMapping(season);
    const seasonMatch = seasonMapping.find(s => s.category === candle.fragranceCategory);
    if (seasonMatch) {
      score += seasonMatch.weight * 15;
      const seasonPref = storage.getSeasonPreferenceByCode(season);
      reasons.push(`季节匹配: ${seasonPref?.name || season} - ${seasonMatch.reason}`);
    }
  }

  const candleRatings = userRatings.filter(r => r.candleId === candle.id);
  if (candleRatings.length > 0) {
    const avgRating = candleRatings.reduce((sum, r) => sum + r.rating, 0) / candleRatings.length;
    score += (avgRating - 3) * 10;
    reasons.push(`历史评分: ${avgRating.toFixed(1)}分`);
  }

  if (userPreferences?.intensityPreference && candle.intensity) {
    if (userPreferences.intensityPreference === candle.intensity) {
      score += 5;
      reasons.push(`浓度偏好匹配: ${candle.intensity}`);
    }
  }

  const inventoryItem = inventory.find(i =>
    i.brand === candle.brand && i.capacity === candle.capacity
  );

  let inStock = false;
  let stockQuantity = 0;
  if (inventoryItem) {
    inStock = true;
    stockQuantity = inventoryItem.quantity;
    if (stockQuantity > 0) {
      score += 10;
      reasons.push(`库存充足: 当前库存 ${stockQuantity} 个，优先使用`);
    }
  }

  const categoryRatings = userRatings
    .filter(r => {
      const ratedCandle = storage.getCandleById(r.candleId);
      return ratedCandle && ratedCandle.fragranceCategory === candle.fragranceCategory;
    });

  if (categoryRatings.length > 0) {
    const categoryAvg = categoryRatings.reduce((sum, r) => sum + r.rating, 0) / categoryRatings.length;
    if (categoryAvg >= 4) {
      score += 8;
      reasons.push(`同类香调好评: 该香调平均评分 ${categoryAvg.toFixed(1)}分`);
    }
  }

  if (candle.scentTags && userPreferences?.desiredMoods) {
    const moodTagBoost = calculateMoodTagBoost(candle.scentTags, userPreferences.desiredMoods);
    if (moodTagBoost > 0) {
      score += moodTagBoost;
      reasons.push(`情绪标签加成: +${moodTagBoost.toFixed(1)}分`);
    }
  }

  return {
    score: Number(score.toFixed(1)),
    reasons,
    inStock,
    stockQuantity,
    allergyWarning: null,
    excludeWarning: null
  };
}

function calculateCategoryPreferenceScores(userId, preferences, ratings) {
  const scores = {};
  let totalWeight = 0;

  ratings.forEach(r => {
    const candle = storage.getCandleById(r.candleId);
    if (!candle || !candle.fragranceCategory) return;

    const weight = (r.rating - 3) * 0.5 + 1;
    totalWeight += weight;

    if (!scores[candle.fragranceCategory]) {
      scores[candle.fragranceCategory] = 0;
    }
    scores[candle.fragranceCategory] += r.rating * weight;
  });

  if (preferences?.desiredMoods) {
    preferences.desiredMoods.forEach(mood => {
      const moodMapping = storage.getMoodFragranceMapping(mood);
      moodMapping.forEach(m => {
        if (!scores[m.category]) {
          scores[m.category] = 0;
        }
        scores[m.category] += 3 * m.weight;
        totalWeight += m.weight;
      });
    });
  }

  if (preferences?.seasonPreference) {
    const seasonMapping = storage.getSeasonFragranceMapping(preferences.seasonPreference);
    seasonMapping.forEach(s => {
      if (!scores[s.category]) {
        scores[s.category] = 0;
      }
      scores[s.category] += 2 * s.weight;
      totalWeight += s.weight;
    });
  }

  if (totalWeight > 0) {
    Object.keys(scores).forEach(key => {
      scores[key] = Number((scores[key] / totalWeight * 100).toFixed(1));
    });
  }

  return scores;
}

function calculateMoodTagBoost(scentTags, desiredMoods) {
  const moodTagMap = {
    sleep: ['薰衣草', '檀香', '洋甘菊', '橙花'],
    relax: ['薰衣草', '茉莉', '檀香', '橙花', '小苍兰'],
    focus: ['薄荷', '柠檬', '迷迭香', '鼠尾草'],
    deodorize: ['柠檬', '柑橘', '薄荷', '茶树'],
    romance: ['玫瑰', '茉莉', '晚香玉', '麝香'],
    festive: ['香草', '肉桂', '柑橘', '琥珀'],
    energize: ['柠檬', '薄荷', '葡萄柚', '柑橘'],
    meditate: ['檀香', '雪松', '乳香', '鼠尾草']
  };

  let boost = 0;
  desiredMoods.forEach(mood => {
    const tags = moodTagMap[mood] || [];
    const matches = scentTags.filter(tag => tags.includes(tag));
    boost += matches.length * 3;
  });

  return boost;
}

function detectScentConflicts(candles) {
  const conflicts = [];
  const allTags = candles.flatMap(c => c.scentTags || []);

  for (let i = 0; i < candles.length; i++) {
    for (let j = i + 1; j < candles.length; j++) {
      const candle1 = candles[i];
      const candle2 = candles[j];

      if (!candle1.scentTags || !candle2.scentTags) continue;

      for (const tag1 of candle1.scentTags) {
        for (const tag2 of candle2.scentTags) {
          const conflict = storage.getScentConflict(tag1, tag2);
          if (conflict) {
            conflicts.push({
              candle1: {
                id: candle1.id,
                brand: candle1.brand,
                name: candle1.name,
                tag: tag1
              },
              candle2: {
                id: candle2.id,
                brand: candle2.brand,
                name: candle2.name,
                tag: tag2
              },
              reason: conflict.reason
            });
          }
        }
      }
    }
  }

  return conflicts;
}

function generateRecommendations(userId, options = {}) {
  const uid = normalizeUserId(userId);
  const {
    scene,
    mood,
    season,
    maxCandles = 3,
    roomSize
  } = options;

  const preferences = storage.getUserScentPreferences(uid);
  const ratings = storage.getUserRatings({ userId: uid });
  const inventory = storage.getAvailableInventoryCandles(uid);

  if (!preferences && ratings.length === 0) {
    return {
      status: 'insufficient_data',
      message: '用户数据不足，请先上报评分或设置偏好以获取个性化推荐',
      recommendations: [],
      warnings: []
    };
  }

  if (scene) {
    const validScenes = [...new Set(storage.sceneFragranceMapping.map(m => m.scene))];
    if (!validScenes.includes(scene)) {
      return {
        status: 'invalid_scene',
        message: `未知场景: ${scene}`,
        validScenes,
        recommendations: [],
        warnings: []
      };
    }
  }

  if (mood) {
    const validMoods = [...new Set(storage.moodFragranceMapping.map(m => m.mood))];
    if (!validMoods.includes(mood)) {
      return {
        status: 'invalid_mood',
        message: `未知情绪目标: ${mood}`,
        validMoods,
        recommendations: [],
        warnings: []
      };
    }
  }

  const allCandles = storage.getAllCandles();
  const scorableCandles = allCandles.filter(c => c.fragranceCategory);

  if (scorableCandles.length === 0) {
    return {
      status: 'no_scent_data',
      message: '暂无配置香调信息的蜡烛',
      recommendations: [],
      warnings: []
    };
  }

  const scoredCandles = scorableCandles.map(candle => {
    const scoreResult = calculateCandleScore(candle, uid, {
      scene,
      mood,
      season,
      preferences,
      ratings,
      availableInventory: inventory
    });

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
      ...scoreResult
    };
  });

  const filteredCandles = scoredCandles.filter(s => s.score > 0);

  if (filteredCandles.length === 0) {
    const allergyCount = scoredCandles.filter(s => s.allergyWarning).length;
    const excludeCount = scoredCandles.filter(s => s.excludeWarning).length;

    let message = '暂无符合条件的推荐';
    if (allergyCount > 0) {
      message += `，其中 ${allergyCount} 款含有过敏成分已排除`;
    }
    if (excludeCount > 0) {
      message += `，${excludeCount} 款含有排斥成分已排除`;
    }

    return {
      status: 'no_matching',
      message,
      recommendations: [],
      warnings: [],
      filteredCount: scoredCandles.length - filteredCandles.length,
      allergyCount,
      excludeCount
    };
  }

  filteredCandles.sort((a, b) => b.score - a.score);

  const maxResults = Math.min(maxCandles, filteredCandles.length);
  const topRecommendations = filteredCandles.slice(0, maxResults);

  const conflicts = detectScentConflicts(topRecommendations.map(r => r.candle));

  const inStockCount = topRecommendations.filter(r => r.inStock && r.stockQuantity > 0).length;
  const stockSatisfied = inStockCount === topRecommendations.length;

  const allergyWarnings = topRecommendations
    .filter(r => r.allergyWarning)
    .map(r => ({
      candle: r.candle,
      ...r.allergyWarning
    }));

  const excludeWarnings = topRecommendations
    .filter(r => r.excludeWarning)
    .map(r => ({
      candle: r.candle,
      ...r.excludeWarning
    }));

  const usageSuggestion = generateUsageSuggestion(topRecommendations, roomSize);

  const sceneName = scene ? storage.getUsageScenarioByCode(scene)?.name || scene : null;
  const moodName = mood ? storage.getMoodGoalByCode(mood)?.name || mood : null;
  const seasonName = season ? storage.getSeasonPreferenceByCode(season)?.name || season : null;

  return {
    status: 'success',
    userId: uid,
    queryContext: {
      scene: sceneName,
      mood: moodName,
      season: seasonName,
      roomSize: roomSize || null
    },
    recommendations: topRecommendations.map((r, index) => ({
      rank: index + 1,
      matchScore: r.score,
      candle: r.candle,
      reasons: r.reasons,
      inStock: r.inStock,
      stockQuantity: r.stockQuantity
    })),
    conflictWarnings: conflicts,
    allergyWarnings,
    excludeWarnings,
    stockStatus: {
      inStockCount,
      totalCount: topRecommendations.length,
      fullyStocked: stockSatisfied,
      message: stockSatisfied
        ? '所有推荐均有库存，可直接使用'
        : `部分推荐缺货，${inStockCount}/${topRecommendations.length} 款有货`
    },
    usageSuggestion,
    lastUpdated: Date.now()
  };
}

function generateUsageSuggestion(recommendations, roomSize) {
  if (recommendations.length === 0) return null;

  let candleCount = recommendations.length;
  if (roomSize) {
    if (roomSize < 15) candleCount = Math.min(1, candleCount);
    else if (roomSize < 30) candleCount = Math.min(2, candleCount);
    else if (roomSize < 50) candleCount = Math.min(3, candleCount);
    else candleCount = Math.min(4, candleCount);
  }

  const primary = recommendations[0];
  const suggestion = {
    primaryCandle: {
      candle: primary.candle,
      usage: `作为主香调使用，适合${roomSize ? roomSize + '平米' : '常规'}空间`,
      priority: '优先使用库存'
    },
    recommendedCandleCount: candleCount,
    layeringTip: null,
    timingTip: '建议每次燃烧不超过4小时，首次燃烧需形成完整蜡池'
  };

  if (candleCount >= 2 && recommendations.length >= 2) {
    const secondary = recommendations[1];
    suggestion.layeringTip = `可与${secondary.candle.brand} ${secondary.candle.name}叠香使用，营造层次感`;
  }

  if (primary.inStock && primary.stockQuantity > 1) {
    suggestion.primaryCandle.usage += `，当前库存${primary.stockQuantity}个，可安心使用`;
  }

  return suggestion;
}

function generateInventoryUsagePlan(userId) {
  const uid = normalizeUserId(userId);
  const inventory = storage.getAvailableInventoryCandles(uid);
  const preferences = storage.getUserScentPreferences(uid);
  const ratings = storage.getUserRatings({ userId: uid });

  if (inventory.length === 0) {
    return {
      status: 'no_inventory',
      message: '当前库存为空，请先上报库存',
      usagePlan: [],
      purchaseSuggestions: []
    };
  }

  const scorableInventory = inventory.filter(item => item.candle.fragranceCategory);

  if (scorableInventory.length === 0) {
    return {
      status: 'no_scent_inventory',
      message: '库存中的蜡烛未配置香调信息',
      usagePlan: [],
      purchaseSuggestions: []
    };
  }

  const categoryScores = calculateCategoryPreferenceScores(uid, preferences, ratings);

  const prioritizedInventory = scorableInventory.map(item => {
    const scoreResult = calculateCandleScore(item.candle, uid, {
      preferences,
      ratings,
      availableInventory: inventory
    });

    let priority = 'normal';
    let priorityReason = '';

    if (item.quantity >= 3) {
      priority = 'high';
      priorityReason = '库存充足，优先使用';
    } else if (item.quantity === 2) {
      priority = 'medium';
      priorityReason = '库存适中，可按计划使用';
    } else {
      priority = 'low';
      priorityReason = '库存紧张，建议尽快补货';
    }

    if (scoreResult.allergyWarning) {
      priority = 'avoid';
      priorityReason = scoreResult.allergyWarning.message;
    } else if (scoreResult.excludeWarning) {
      priority = 'avoid';
      priorityReason = scoreResult.excludeWarning.message;
    }

    const categoryName = item.candle.fragranceCategory
      ? storage.getFragranceCategoryByCode(item.candle.fragranceCategory)?.name || item.candle.fragranceCategory
      : '未分类';

    const commonSpaces = preferences?.commonSpaces || [];
    const usageScenarios = commonSpaces.map(space => {
      const scenario = storage.getUsageScenarioByCode(space);
      const mapping = storage.getSceneFragranceMapping(space);
      const match = mapping.find(m => m.category === item.candle.fragranceCategory);
      return {
        space: scenario?.name || space,
        suitable: match ? true : false,
        reason: match?.reason || '该空间未配置推荐香调'
      };
    });

    const desiredMoods = preferences?.desiredMoods || [];
    const moodSuitability = desiredMoods.map(mood => {
      const goal = storage.getMoodGoalByCode(mood);
      const mapping = storage.getMoodFragranceMapping(mood);
      const match = mapping.find(m => m.category === item.candle.fragranceCategory);
      return {
        mood: goal?.name || mood,
        suitable: match ? true : false,
        reason: match?.reason || '该情绪未配置推荐香调'
      };
    });

    return {
      inventoryId: item.id,
      candle: {
        id: item.candle.id,
        brand: item.candle.brand,
        name: item.candle.name,
        fragranceCategory: item.candle.fragranceCategory,
        categoryName,
        scentTags: item.candle.scentTags,
        intensity: item.candle.intensity,
        capacity: item.candle.capacity,
        unit: item.candle.unit,
        price: item.candle.price
      },
      quantity: item.quantity,
      matchScore: scoreResult.score,
      priority,
      priorityReason,
      allergyWarning: scoreResult.allergyWarning,
      excludeWarning: scoreResult.excludeWarning,
      usageSuggestions: {
        scenarios: usageScenarios,
        moods: moodSuitability
      },
      lastUpdated: item.lastUpdated
    };
  });

  prioritizedInventory.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, normal: 2, low: 3, avoid: 4 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.matchScore - a.matchScore;
  });

  const safeToUse = prioritizedInventory.filter(i => i.priority !== 'avoid');
  const toAvoid = prioritizedInventory.filter(i => i.priority === 'avoid');

  const conflicts = detectScentConflicts(safeToUse.map(i => i.candle));

  const categoryInventory = {};
  safeToUse.forEach(item => {
    const cat = item.candle.fragranceCategory;
    if (!categoryInventory[cat]) {
      categoryInventory[cat] = { quantity: 0, value: 0, items: [] };
    }
    categoryInventory[cat].quantity += item.quantity;
    categoryInventory[cat].value += item.quantity * item.candle.price;
    categoryInventory[cat].items.push({
      brand: item.candle.brand,
      name: item.candle.name,
      quantity: item.quantity
    });
  });

  const purchaseSuggestions = generatePurchaseSuggestions(uid, safeToUse, preferences, ratings);

  return {
    status: 'success',
    userId: uid,
    totalInventoryItems: inventory.length,
    usableItems: safeToUse.length,
    avoidItems: toAvoid.length,
    totalValue: Number(safeToUse.reduce((sum, i) => sum + i.quantity * i.candle.price, 0).toFixed(2)),
    usagePlan: safeToUse,
    itemsToAvoid: toAvoid,
    conflictWarnings: conflicts,
    inventoryByCategory: Object.entries(categoryInventory).map(([code, data]) => {
      const cat = storage.getFragranceCategoryByCode(code);
      return {
        code,
        name: cat?.name || code,
        totalQuantity: data.quantity,
        totalValue: Number(data.value.toFixed(2)),
        items: data.items
      };
    }),
    purchaseSuggestions,
    lastUpdated: Date.now()
  };
}

function generatePurchaseSuggestions(userId, currentInventory, preferences, ratings) {
  const uid = normalizeUserId(userId);
  const prefs = preferences || storage.getUserScentPreferences(uid);
  const userRatings = ratings || storage.getUserRatings({ userId: uid });

  const categoryScores = calculateCategoryPreferenceScores(uid, prefs, userRatings);
  const allCandles = storage.getAllCandles();
  const inventoryBrands = new Set(currentInventory.map(i => `${i.candle.brand}-${i.candle.capacity}`));

  const missingCategories = [];
  const lowStockItems = [];
  const complementaryItems = [];

  Object.entries(categoryScores).forEach(([code, score]) => {
    if (score < 30) return;

    const hasInInventory = currentInventory.some(i => i.candle.fragranceCategory === code);
    if (!hasInInventory) {
      const category = storage.getFragranceCategoryByCode(code);
      const candles = storage.getCandlesByFragranceCategory(code);
      if (candles.length > 0) {
        const topCandle = candles[0];
        missingCategories.push({
          category: code,
          categoryName: category?.name || code,
          preferenceScore: score,
          reason: `该香调偏好评分${score}分，但库存中暂无，建议采购`,
          recommendedCandles: candles.slice(0, 3).map(c => ({
            id: c.id,
            brand: c.brand,
            name: c.name,
            price: c.price,
            scentTags: c.scentTags
          }))
        });
      }
    }
  });

  currentInventory.forEach(item => {
    if (item.quantity <= 1 && item.priority !== 'avoid') {
      lowStockItems.push({
        candle: item.candle,
        currentQuantity: item.quantity,
        reason: item.priorityReason,
        suggestedQuantity: Math.max(2, Math.ceil(item.quantity * 1.5)),
        estimatedCost: Math.max(2, Math.ceil(item.quantity * 1.5)) * item.candle.price
      });
    }
  });

  if (prefs?.desiredMoods) {
    prefs.desiredMoods.forEach(mood => {
      const moodMapping = storage.getMoodFragranceMapping(mood);
      moodMapping.forEach(m => {
        const candles = storage.getCandlesByFragranceCategory(m.category);
        candles.forEach(candle => {
          const key = `${candle.brand}-${candle.capacity}`;
          if (!inventoryBrands.has(key) && categoryScores[m.category] >= 25) {
            const exists = complementaryItems.find(c => c.candle.id === candle.id);
            if (!exists) {
              complementaryItems.push({
                candle: {
                  id: candle.id,
                  brand: candle.brand,
                  name: candle.name,
                  fragranceCategory: candle.fragranceCategory,
                  scentTags: candle.scentTags,
                  price: candle.price
                },
                reason: `为${storage.getMoodGoalByCode(mood)?.name || mood}场景补充${m.weight * 100}%匹配度的香调`
              });
            }
          }
        });
      });
    });
  }

  const totalEstimatedCost = Number(
    lowStockItems.reduce((sum, i) => sum + i.estimatedCost, 0) +
    complementaryItems.slice(0, 3).reduce((sum, i) => sum + i.candle.price, 0)
  ).toFixed(2);

  return {
    missingCategories,
    lowStockItems,
    complementaryItems: complementaryItems.slice(0, 5),
    summary: {
      missingCategoriesCount: missingCategories.length,
      lowStockCount: lowStockItems.length,
      complementaryCount: complementaryItems.length,
      totalEstimatedCost
    }
  };
}

module.exports = {
  calculateCandleScore,
  calculateCategoryPreferenceScores,
  detectScentConflicts,
  generateRecommendations,
  generateInventoryUsagePlan,
  generatePurchaseSuggestions
};
