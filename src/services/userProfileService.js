const { storage, normalizeUserId } = require('../storage/memoryStorage');
const consumptionService = require('./consumptionService');
const inventoryService = require('./inventoryService');
const tipsService = require('./tipsService');
const { parsePositiveInteger, parseNumber } = require('../utils/validator');

const URGENT_DAYS = 3;
const WARNING_DAYS = 7;
const OBSERVE_DAYS = 14;

function generateUserProfile(userId) {
  const uid = normalizeUserId(userId);

  const records = storage.getBurningRecords({ userId: uid });
  const inventory = storage.getInventory({ userId: uid });
  const models = storage.getAllConsumptionModels(uid);
  const candles = storage.getAllCandles();

  if (records.length === 0 && inventory.length === 0) {
    return {
      userId: uid,
      profileStatus: 'insufficient_data',
      message: '用户数据不足，请先上报库存和燃烧记录以生成画像',
      lastUpdated: Date.now()
    };
  }

  const brandStats = {};
  const waxTypeStats = {};
  const wickSizeStats = {};
  const capacityStats = [];
  const sceneStats = {};
  let totalBurnHours = 0;
  let totalBurnedGrams = 0;
  const tempReadings = [];
  const humidityReadings = [];
  const efficiencyScores = [];
  const burnRates = [];

  records.forEach(record => {
    if (record.brand) {
      if (!brandStats[record.brand]) {
        brandStats[record.brand] = { count: 0, totalBurnHours: 0, totalBurned: 0 };
      }
      brandStats[record.brand].count++;
      brandStats[record.brand].totalBurnHours += record.burnHours || 0;
      brandStats[record.brand].totalBurned += record.actualBurned || 0;
    }

    const candle = record.candleId ? storage.getCandleById(record.candleId) :
      (record.brand && record.capacity ? storage.getCandleByBrandAndCapacity(record.brand, record.capacity) : null);

    if (candle) {
      if (!waxTypeStats[candle.waxType]) {
        waxTypeStats[candle.waxType] = { count: 0, totalBurnHours: 0 };
      }
      waxTypeStats[candle.waxType].count++;
      waxTypeStats[candle.waxType].totalBurnHours += record.burnHours || 0;

      if (!wickSizeStats[candle.wickSize]) {
        wickSizeStats[candle.wickSize] = { count: 0, totalBurnHours: 0 };
      }
      wickSizeStats[candle.wickSize].count++;
      wickSizeStats[candle.wickSize].totalBurnHours += record.burnHours || 0;

      capacityStats.push(candle.capacity);

      if (record.temperature !== undefined) {
        tempReadings.push(record.temperature);
      }
      if (record.humidity !== undefined) {
        humidityReadings.push(record.humidity);
      }

      const theoreticalRate = consumptionService.calculateTheoreticalBurnRate(
        candle,
        record.temperature || 22,
        record.humidity || 50
      );
      const actualRate = record.actualBurned / record.burnHours;
      burnRates.push(actualRate);
      if (theoreticalRate > 0) {
        efficiencyScores.push((theoreticalRate / actualRate) * 100);
      }
    }

    if (record.scene) {
      if (!sceneStats[record.scene]) {
        sceneStats[record.scene] = { count: 0, totalBurnHours: 0 };
      }
      sceneStats[record.scene].count++;
      sceneStats[record.scene].totalBurnHours += record.burnHours || 0;
    }

    totalBurnHours += record.burnHours || 0;
    totalBurnedGrams += record.actualBurned || 0;
  });

  const preferredBrand = Object.entries(brandStats)
    .sort((a, b) => b[1].totalBurnHours - a[1].totalBurnHours)[0]?.[0] || null;

  const preferredWaxType = Object.entries(waxTypeStats)
    .sort((a, b) => b[1].totalBurnHours - a[1].totalBurnHours)[0]?.[0] || null;

  const preferredWickSize = Object.entries(wickSizeStats)
    .sort((a, b) => b[1].totalBurnHours - a[1].totalBurnHours)[0]?.[0] || null;

  const avgCapacity = capacityStats.length > 0
    ? capacityStats.reduce((a, b) => a + b, 0) / capacityStats.length
    : null;

  const avgTemp = tempReadings.length > 0
    ? tempReadings.reduce((a, b) => a + b, 0) / tempReadings.length
    : null;

  const avgHumidity = humidityReadings.length > 0
    ? humidityReadings.reduce((a, b) => a + b, 0) / humidityReadings.length
    : null;

  const avgEfficiency = efficiencyScores.length > 0
    ? efficiencyScores.reduce((a, b) => a + b, 0) / efficiencyScores.length
    : null;

  const avgBurnRate = burnRates.length > 0
    ? burnRates.reduce((a, b) => a + b, 0) / burnRates.length
    : null;

  const usagePattern = analyzeUsagePattern(records);

  const inventoryValue = inventoryService.calculateTotalInventoryValue(
    inventory.map(item => {
      const candle = storage.getCandleByBrandAndCapacity(item.brand, item.capacity);
      return { ...item, price: candle?.price || 0 };
    })
  );

  const anomalySummary = detectUserAnomalies(records);

  const profile = {
    userId: uid,
    profileStatus: 'complete',
    summary: {
      totalRecords: records.length,
      totalInventoryItems: inventory.length,
      totalBurnHours: Number(totalBurnHours.toFixed(1)),
      totalBurnedGrams: Number(totalBurnedGrams.toFixed(1)),
      inventoryValue: Number(inventoryValue.toFixed(2)),
      dataPoints: records.length
    },
    preferences: {
      preferredBrand,
      preferredWaxType,
      preferredWickSize,
      averageCapacity: avgCapacity ? Number(avgCapacity.toFixed(0)) : null,
      brandDistribution: Object.entries(brandStats).map(([brand, stats]) => ({
        brand,
        usageCount: stats.count,
        totalBurnHours: Number(stats.totalBurnHours.toFixed(1)),
        percentage: totalBurnHours > 0 ? Number((stats.totalBurnHours / totalBurnHours * 100).toFixed(1)) : 0
      })),
      waxTypeDistribution: Object.entries(waxTypeStats).map(([type, stats]) => ({
        type,
        usageCount: stats.count,
        percentage: totalBurnHours > 0 ? Number((stats.totalBurnHours / totalBurnHours * 100).toFixed(1)) : 0
      })),
      sceneDistribution: Object.entries(sceneStats).map(([scene, stats]) => ({
        scene,
        usageCount: stats.count,
        totalBurnHours: Number(stats.totalBurnHours.toFixed(1)),
        percentage: totalBurnHours > 0 ? Number((stats.totalBurnHours / totalBurnHours * 100).toFixed(1)) : 0
      }))
    },
    burnMetrics: {
      averageBurnRate: avgBurnRate ? Number(avgBurnRate.toFixed(2)) : null,
      averageEfficiency: avgEfficiency ? Number(avgEfficiency.toFixed(1)) : null,
      averageTemperature: avgTemp ? Number(avgTemp.toFixed(1)) : null,
      averageHumidity: avgHumidity ? Number(avgHumidity.toFixed(1)) : null,
      temperatureProfile: avgTemp ? consumptionService.classifyTemperature(avgTemp) : null,
      humidityProfile: avgHumidity ? consumptionService.classifyHumidity(avgHumidity) : null
    },
    usagePattern,
    inventorySummary: {
      totalItems: inventory.length,
      totalQuantity: inventory.reduce((sum, i) => sum + (i.quantity || 0), 0),
      totalValue: Number(inventoryValue.toFixed(2)),
      byBrand: Object.entries(
        inventory.reduce((acc, item) => {
          if (!acc[item.brand]) acc[item.brand] = { quantity: 0, value: 0 };
          const candle = storage.getCandleByBrandAndCapacity(item.brand, item.capacity);
          acc[item.brand].quantity += item.quantity || 0;
          acc[item.brand].value += (item.quantity || 0) * (candle?.price || 0);
          return acc;
        }, {})
      ).map(([brand, data]) => ({
        brand,
        quantity: data.quantity,
        value: Number(data.value.toFixed(2))
      }))
    },
    anomalies: anomalySummary,
    lastUpdated: Date.now()
  };

  storage.saveUserProfile(uid, profile);
  return profile;
}

function analyzeUsagePattern(records) {
  if (!records || records.length === 0) {
    return {
      frequency: 'unknown',
      sessionLength: 'unknown',
      averageSessionHours: null,
      totalSessions: 0,
      estimatedWeeklyUsageHours: null
    };
  }

  const avgSessionHours = records.reduce((sum, r) => sum + r.burnHours, 0) / records.length;
  const totalSessions = records.length;

  let frequency = 'occasional';
  if (records.length >= 7) {
    const timestamps = records.map(r => r.timestamp).sort();
    const daysSpan = (timestamps[timestamps.length - 1] - timestamps[0]) / (1000 * 60 * 60 * 24);
    if (daysSpan > 0) {
      const sessionsPerWeek = (totalSessions / daysSpan) * 7;
      if (sessionsPerWeek >= 5) frequency = 'frequent';
      else if (sessionsPerWeek >= 2) frequency = 'regular';
    }
  }

  let sessionLength = 'short';
  if (avgSessionHours >= 4) sessionLength = 'long';
  else if (avgSessionHours >= 2) sessionLength = 'medium';

  const timestamps = records.map(r => r.timestamp).sort();
  const daysSpan = timestamps.length > 1
    ? Math.max(1, (timestamps[timestamps.length - 1] - timestamps[0]) / (1000 * 60 * 60 * 24))
    : 1;
  const weeklyHours = (totalSessions * avgSessionHours / daysSpan) * 7;

  return {
    frequency,
    sessionLength,
    averageSessionHours: Number(avgSessionHours.toFixed(1)),
    totalSessions,
    estimatedWeeklyUsageHours: Number(weeklyHours.toFixed(1))
  };
}

function detectUserAnomalies(records) {
  const anomalyTypes = {};
  let totalAnomalies = 0;

  records.forEach(record => {
    const anomalies = consumptionService.detectAnomaly(record);
    anomalies.forEach(a => {
      if (!anomalyTypes[a.type]) {
        anomalyTypes[a.type] = { count: 0, avgDeviation: 0 };
      }
      anomalyTypes[a.type].count++;
      anomalyTypes[a.type].avgDeviation += Math.abs(a.deviation);
      totalAnomalies++;
    });
  });

  return {
    totalAnomalies,
    anomalyRate: records.length > 0 ? Number((totalAnomalies / records.length * 100).toFixed(1)) : 0,
    details: Object.entries(anomalyTypes).map(([type, data]) => ({
      type,
      count: data.count,
      avgDeviation: Number((data.avgDeviation / data.count).toFixed(1)),
      percentage: totalAnomalies > 0 ? Number((data.count / totalAnomalies * 100).toFixed(1)) : 0
    }))
  };
}

function generateInventoryPrediction(userId, days = 7) {
  const uid = normalizeUserId(userId);
  const validDays = [7, 14, 30];
  if (!validDays.includes(days)) {
    throw new Error('预测天数必须是 7、14 或 30 天');
  }

  const profile = generateUserProfile(uid);
  if (profile.profileStatus === 'insufficient_data') {
    return {
      userId: uid,
      predictionDays: days,
      status: 'insufficient_data',
      message: '数据不足，无法生成预测，请先上报更多燃烧记录',
      predictions: [],
      lastUpdated: Date.now()
    };
  }

  const inventory = storage.getInventory({ userId: uid });
  const predictions = [];
  const errors = [];

  inventory.forEach((item, index) => {
    const candle = storage.getCandleByBrandAndCapacity(item.brand, item.capacity);
    if (!candle) {
      errors.push(`库存项 ${index + 1}：未找到品牌 ${item.brand} 容量 ${item.capacity} 的蜡烛信息`);
      return;
    }

    const model = storage.getConsumptionModel(candle.id, uid);
    const prediction = inventoryService.predictInventoryDays(item, model);

    const dailyConsumption = prediction?.dailyConsumptionGrams || calculateEstimatedDailyConsumption(uid, candle);
    const totalAvailable = item.quantity * item.capacity;
    const projectedUsage = dailyConsumption * days;
    const remainingAfterPeriod = Math.max(0, totalAvailable - projectedUsage);
    const estimatedDaysLeft = dailyConsumption > 0 ? Math.floor(totalAvailable / dailyConsumption) : null;

    let replenishmentStatus = 'normal';
    if (estimatedDaysLeft !== null) {
      if (estimatedDaysLeft <= URGENT_DAYS) replenishmentStatus = 'urgent';
      else if (estimatedDaysLeft <= WARNING_DAYS) replenishmentStatus = 'warning';
      else if (estimatedDaysLeft <= OBSERVE_DAYS) replenishmentStatus = 'observe';
    }

    predictions.push({
      id: item.id,
      brand: item.brand,
      capacity: item.capacity,
      quantity: item.quantity,
      scene: item.scene || null,
      price: candle.price,
      totalAvailableGrams: totalAvailable,
      dailyConsumptionGrams: Number(dailyConsumption.toFixed(2)),
      projectedUsageForPeriod: Number(projectedUsage.toFixed(1)),
      remainingAfterPeriod: Number(remainingAfterPeriod.toFixed(1)),
      estimatedDaysLeft,
      replenishmentStatus,
      warningDays: WARNING_DAYS,
      lastUpdated: item.lastUpdated,
      dataValid: true
    });
  });

  const urgentItems = predictions.filter(p => p.replenishmentStatus === 'urgent');
  const warningItems = predictions.filter(p => p.replenishmentStatus === 'warning');
  const observeItems = predictions.filter(p => p.replenishmentStatus === 'observe');

  return {
    userId: uid,
    predictionDays: days,
    status: 'success',
    predictions,
    summary: {
      totalItems: predictions.length,
      urgentCount: urgentItems.length,
      warningCount: warningItems.length,
      observeCount: observeItems.length,
      normalCount: predictions.filter(p => p.replenishmentStatus === 'normal').length,
      totalDailyConsumption: Number(predictions.reduce((sum, p) => sum + p.dailyConsumptionGrams, 0).toFixed(2)),
      totalProjectedUsage: Number(predictions.reduce((sum, p) => sum + p.projectedUsageForPeriod, 0).toFixed(1))
    },
    dataErrors: errors,
    validCount: predictions.length,
    invalidCount: inventory.length - predictions.length,
    lastUpdated: Date.now()
  };
}

function calculateEstimatedDailyConsumption(userId, candle) {
  const uid = normalizeUserId(userId);
  const profile = storage.getUserProfile(uid);

  const avgSessionHours = profile?.usagePattern?.averageSessionHours || 2;
  const frequency = profile?.usagePattern?.frequency || 'occasional';

  const dailyFactor = frequency === 'frequent' ? 0.7 :
    frequency === 'regular' ? 0.4 : 0.2;

  const temp = profile?.burnMetrics?.averageTemperature || 22;
  const humidity = profile?.burnMetrics?.averageHumidity || 50;

  const burnRate = consumptionService.calculateTheoreticalBurnRate(candle, temp, humidity);
  const efficiency = profile?.burnMetrics?.averageEfficiency
    ? profile.burnMetrics.averageEfficiency / 100
    : 1;

  return avgSessionHours * dailyFactor * burnRate * efficiency;
}

function generateReplenishmentList(userId, days = 7) {
  const uid = normalizeUserId(userId);

  const prediction = generateInventoryPrediction(uid, days);
  if (prediction.status === 'insufficient_data') {
    return prediction;
  }

  const urgentItems = [];
  const observeItems = [];
  const valueRecommendations = [];
  const burningTips = [];

  const brandEfficiencies = consumptionService.getBrandEfficiency(uid);
  const userProfile = storage.getUserProfile(uid);

  prediction.predictions.forEach(item => {
    const recommendedQuantity = calculateRecommendedQuantity(item, days);

    if (item.replenishmentStatus === 'urgent') {
      urgentItems.push({
        ...item,
        recommendedQuantity,
        urgency: '紧急补货',
        reason: `库存仅剩 ${item.estimatedDaysLeft} 天，${days}天内将耗尽`,
        estimatedCost: recommendedQuantity * item.price
      });
    } else if (item.replenishmentStatus === 'warning' || item.replenishmentStatus === 'observe') {
      observeItems.push({
        ...item,
        recommendedQuantity: Math.ceil(recommendedQuantity * 0.5),
        urgency: item.replenishmentStatus === 'warning' ? '观察补货' : '预备补货',
        reason: `库存可维持 ${item.estimatedDaysLeft} 天，建议观察使用频率后决定`,
        estimatedCost: Math.ceil(recommendedQuantity * 0.5) * item.price
      });
    }
  });

  const validEfficiencies = brandEfficiencies.filter(e => e.valueScore !== null);
  const sortedByValue = [...validEfficiencies].sort((a, b) => b.valueScore - a.valueScore);

  const preferredBrands = new Set(
    userProfile?.preferences?.brandDistribution?.map(b => b.brand) || []
  );

  sortedByValue.slice(0, 3).forEach(e => {
    const isPreferred = preferredBrands.has(e.brand);
    valueRecommendations.push({
      brand: e.brand,
      valueScore: e.valueScore,
      price: e.price,
      capacity: e.capacity,
      estimatedTotalHours: e.estimatedTotalHours,
      isPreferredBrand: isPreferred,
      recommendation: isPreferred
        ? `您常用的品牌 ${e.brand} 性价比评分 ${e.valueScore}，继续使用`
        : `性价比替代推荐：${e.brand}，评分 ${e.valueScore}，可比当前首选品牌节省约 ${calculateSavings(userProfile, e)}%`
    });
  });

  if (userProfile?.anomalies?.totalAnomalies > 0) {
    const anomalyTypes = userProfile.anomalies.details.map(d => d.type);
    const tips = tipsService.getTipsForAnomalies(
      anomalyTypes.map(type => ({ type }))
    );
    burningTips.push(...tips);
  }

  if (userProfile?.burnMetrics?.averageEfficiency < 85) {
    const efficiencyTips = storage.getTipsByType('efficiency');
    burningTips.push(...efficiencyTips);
  }

  if (userProfile?.usagePattern?.sessionLength === 'long') {
    const tunnelingTips = storage.getTipsByType('tunneling');
    burningTips.push(...tunnelingTips);
  }

  const totalUrgentCost = urgentItems.reduce((sum, i) => sum + i.estimatedCost, 0);
  const totalObserveCost = observeItems.reduce((sum, i) => sum + i.estimatedCost, 0);

  return {
    userId: uid,
    predictionDays: days,
    status: 'success',
    urgentReplenishment: {
      items: urgentItems,
      totalQuantity: urgentItems.reduce((sum, i) => sum + i.recommendedQuantity, 0),
      totalEstimatedCost: Number(totalUrgentCost.toFixed(2)),
      action: '立即下单补货'
    },
    observeReplenishment: {
      items: observeItems,
      totalQuantity: observeItems.reduce((sum, i) => sum + i.recommendedQuantity, 0),
      totalEstimatedCost: Number(totalObserveCost.toFixed(2)),
      action: '加入购物车，观察1-2周后决定'
    },
    valueRecommendations,
    burningTips: [...new Set(burningTips.map(t => JSON.stringify(t)))].map(t => JSON.parse(t)),
    batchPlan: generateBatchPlan(urgentItems, observeItems, days),
    summary: {
      urgentCount: urgentItems.length,
      observeCount: observeItems.length,
      totalEstimatedCost: Number((totalUrgentCost + totalObserveCost).toFixed(2)),
      totalItemsToOrder: urgentItems.reduce((sum, i) => sum + i.recommendedQuantity, 0) +
        observeItems.reduce((sum, i) => sum + i.recommendedQuantity, 0)
    },
    lastUpdated: Date.now()
  };
}

function calculateRecommendedQuantity(item, days) {
  const dailyUsage = item.dailyConsumptionGrams;
  const currentStock = item.totalAvailableGrams;
  const usageDuringPeriod = dailyUsage * days;
  const deficit = Math.max(0, usageDuringPeriod - currentStock);
  const safetyStock = dailyUsage * 7;
  const totalNeeded = deficit + safetyStock;
  return Math.max(1, Math.ceil(totalNeeded / item.capacity));
}

function calculateSavings(userProfile, recommendation) {
  if (!userProfile?.preferences?.preferredBrand) return 10;

  const preferred = userProfile.preferences.brandDistribution
    .find(b => b.brand === userProfile.preferences.preferredBrand);

  const preferredEfficiency = userProfile.burnMetrics?.averageEfficiency || 85;
  const recEfficiency = recommendation.valueScore || 70;

  const savings = Math.max(5, Math.min(40, Math.abs(recEfficiency - preferredEfficiency)));
  return Math.round(savings);
}

function generateBatchPlan(urgentItems, observeItems, days) {
  const allItems = [...urgentItems, ...observeItems];
  const totalCost = allItems.reduce((sum, i) => sum + i.estimatedCost, 0);

  const nextOrderDate = new Date();
  nextOrderDate.setDate(nextOrderDate.getDate() + Math.floor(days * 0.7));

  return {
    optimalOrderFrequency: `每 ${Math.ceil(days * 0.7)} 天补货一次`,
    suggestedNextOrderDate: nextOrderDate.toISOString().split('T')[0],
    batchSizeRecommendation: allItems.length > 0
      ? `建议每次补货 ${Math.ceil(allItems.length * 0.6)} 个品牌，分摊运费`
      : '暂无补货需求',
    totalMonthlyEstimate: Number((totalCost * (30 / days)).toFixed(2)),
    costSavingTip: urgentItems.length > 1
      ? '合并紧急补货订单可享受批量折扣，预计节省5-10%'
      : '单品种补货，建议等待更多需求合并下单'
  };
}

function getUserProfile(userId) {
  const uid = normalizeUserId(userId);
  const profile = storage.getUserProfile(uid);
  if (!profile) {
    return generateUserProfile(userId);
  }
  return profile;
}

module.exports = {
  generateUserProfile,
  getUserProfile,
  generateInventoryPrediction,
  generateReplenishmentList,
  URGENT_DAYS,
  WARNING_DAYS,
  OBSERVE_DAYS
};
