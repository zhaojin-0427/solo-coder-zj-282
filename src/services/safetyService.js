const { storage, normalizeUserId } = require('../storage/memoryStorage');
const consumptionService = require('./consumptionService');

function getCurrentTimePeriod() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

function getTimePeriodMultiplier(timePeriod) {
  const factor = storage.getSafetyFactorByCode('time_period');
  const option = factor?.options?.find(o => o.value === timePeriod);
  return option?.riskMultiplier || 1.0;
}

function getWaxTypeMultiplier(waxType) {
  const factor = storage.getSafetyFactorByCode('wax_type');
  const option = factor?.options?.find(o => o.value === waxType);
  return option?.riskMultiplier || 1.0;
}

function getWickSizeMultiplier(wickSize) {
  const factor = storage.getSafetyFactorByCode('wick_size');
  const option = factor?.options?.find(o => o.value === wickSize);
  return option?.riskMultiplier || 1.0;
}

function getRoomTypeMultiplier(roomType) {
  const factor = storage.getSafetyFactorByCode('room_type');
  const option = factor?.options?.find(o => o.value === roomType);
  return option?.riskMultiplier || 1.0;
}

function calculateCandleRiskScore(candle) {
  if (!candle) return 0;

  const waxMultiplier = getWaxTypeMultiplier(candle.waxType);
  const wickMultiplier = getWickSizeMultiplier(candle.wickSize);

  let baseScore = 10;
  baseScore *= waxMultiplier;
  baseScore *= wickMultiplier;

  if (candle.capacity > 300) baseScore += 5;
  if (candle.intensity === 'strong') baseScore += 3;

  return Math.min(30, Math.round(baseScore));
}

function calculateEnvironmentRiskScore(environment, roomCode) {
  let score = 0;
  const riskFactors = [];

  const maxContinuousBurnRule = storage.getSafetyRuleByCode('max_continuous_burn');
  const minCombustibleRule = storage.getSafetyRuleByCode('min_combustible_distance');
  const minVentilationRule = storage.getSafetyRuleByCode('min_ventilation_distance');
  const lowHumidityRule = storage.getSafetyRuleByCode('max_humidity_low');
  const highTempRule = storage.getSafetyRuleByCode('max_temperature_high');
  const childPresenceRule = storage.getSafetyRuleByCode('child_presence');
  const petPresenceRule = storage.getSafetyRuleByCode('pet_presence');
  const poorVentilationRule = storage.getSafetyRuleByCode('poor_ventilation');

  if (environment.temperature !== undefined) {
    if (environment.temperature > highTempRule.value) {
      score += highTempRule.riskScore;
      riskFactors.push({
        code: 'high_temperature',
        name: '温度过高',
        actual: environment.temperature,
        threshold: highTempRule.value,
        unit: highTempRule.unit,
        riskScore: highTempRule.riskScore
      });
    }
  }

  if (environment.humidity !== undefined) {
    if (environment.humidity < lowHumidityRule.value) {
      score += lowHumidityRule.riskScore;
      riskFactors.push({
        code: 'low_humidity',
        name: '湿度过低',
        actual: environment.humidity,
        threshold: lowHumidityRule.value,
        unit: lowHumidityRule.unit,
        riskScore: lowHumidityRule.riskScore
      });
    }
  }

  if (environment.combustibleDistance !== undefined) {
    if (environment.combustibleDistance < minCombustibleRule.value) {
      const distanceRatio = minCombustibleRule.value / Math.max(1, environment.combustibleDistance);
      const addedScore = Math.round(minCombustibleRule.riskScore * Math.min(1.5, distanceRatio));
      score += addedScore;
      riskFactors.push({
        code: 'combustible_too_close',
        name: '可燃物距离过近',
        actual: environment.combustibleDistance,
        threshold: minCombustibleRule.value,
        unit: minCombustibleRule.unit,
        riskScore: addedScore
      });
    }
  }

  if (environment.ventilationDistance !== undefined) {
    if (environment.ventilationDistance < minVentilationRule.value) {
      score += minVentilationRule.riskScore;
      riskFactors.push({
        code: 'ventilation_insufficient',
        name: '通风距离不足',
        actual: environment.ventilationDistance,
        threshold: minVentilationRule.value,
        unit: minVentilationRule.unit,
        riskScore: minVentilationRule.riskScore
      });
    }
  }

  if (environment.hasChild === true) {
    score += childPresenceRule.riskScore;
    riskFactors.push({
      code: 'child_presence',
      name: '儿童在场',
      riskScore: childPresenceRule.riskScore
    });
  }

  if (environment.hasPet === true) {
    score += petPresenceRule.riskScore;
    riskFactors.push({
      code: 'pet_presence',
      name: '宠物在场',
      riskScore: petPresenceRule.riskScore
    });
  }

  if (environment.isPoorVentilation === true) {
    score += poorVentilationRule.riskScore;
    riskFactors.push({
      code: 'poor_ventilation',
      name: '通风不良',
      riskScore: poorVentilationRule.riskScore
    });
  }

  if (roomCode) {
    const roomMultiplier = getRoomTypeMultiplier(roomCode);
    if (roomMultiplier > 1.0) {
      const roomScore = Math.round(5 * (roomMultiplier - 1));
      score += roomScore;
      riskFactors.push({
        code: 'high_risk_room',
        name: '高风险房间类型',
        roomCode,
        riskScore: roomScore
      });
    }
  }

  const timePeriod = getCurrentTimePeriod();
  const timeMultiplier = getTimePeriodMultiplier(timePeriod);
  if (timeMultiplier > 1.0) {
    const nightBurnRule = storage.getSafetyRuleByCode('night_burning');
    const timeScore = Math.round(nightBurnRule.riskScore * (timeMultiplier - 1));
    score += timeScore;
    riskFactors.push({
      code: 'high_risk_time',
      name: '高风险时段',
      timePeriod,
      riskScore: timeScore
    });
  }

  return {
    baseScore: Math.round(score),
    riskFactors,
    timePeriod
  };
}

function calculateContinuousBurnRisk(activeSession, burningHours = null) {
  const maxBurnRule = storage.getSafetyRuleByCode('max_continuous_burn');
  let duration = null;

  if (activeSession && activeSession.isActive && activeSession.currentDurationHours) {
    duration = activeSession.currentDurationHours;
  } else if (burningHours !== null && burningHours !== undefined) {
    duration = Number(burningHours);
  }

  if (duration === null) return { score: 0, riskFactors: [] };
  const riskFactors = [];
  let score = 0;

  if (duration > maxBurnRule.value) {
    const excessHours = duration - maxBurnRule.value;
    const multiplier = Math.min(2.0, 1 + excessHours / maxBurnRule.value);
    score = Math.round(maxBurnRule.riskScore * multiplier);
    riskFactors.push({
      code: 'exceeded_max_burn_time',
      name: '超过最大连续燃烧时长',
      actual: Number(duration.toFixed(1)),
      threshold: maxBurnRule.value,
      unit: maxBurnRule.unit,
      riskScore: score
    });
  } else if (duration > maxBurnRule.value * 0.75) {
    score = Math.round(maxBurnRule.riskScore * 0.5);
    riskFactors.push({
      code: 'approaching_max_burn_time',
      name: '接近最大连续燃烧时长',
      actual: Number(duration.toFixed(1)),
      threshold: maxBurnRule.value,
      unit: maxBurnRule.unit,
      riskScore: score
    });
  }

  return { score, riskFactors };
}

function calculateHistoricalRiskScore(userId) {
  const uid = normalizeUserId(userId);
  const records = storage.getBurningRecords({ userId: uid });
  const inspectionRecords = storage.getSafetyInspectionRecords({ userId: uid });

  let score = 0;
  const riskFactors = [];

  const anomalyRecords = records.filter(r => {
    const anomalies = consumptionService.detectAnomaly(r);
    return anomalies.length > 0;
  });

  if (anomalyRecords.length > 0) {
    const anomalyRate = anomalyRecords.length / records.length;
    if (anomalyRate > 0.3) {
      score += 15;
      riskFactors.push({
        code: 'frequent_anomalies',
        name: '频繁异常燃烧',
        anomalyCount: anomalyRecords.length,
        totalRecords: records.length,
        anomalyRate: Number((anomalyRate * 100).toFixed(1)),
        riskScore: 15
      });
    } else if (anomalyRate > 0.1) {
      score += 8;
      riskFactors.push({
        code: 'occasional_anomalies',
        name: '偶发异常燃烧',
        anomalyCount: anomalyRecords.length,
        totalRecords: records.length,
        anomalyRate: Number((anomalyRate * 100).toFixed(1)),
        riskScore: 8
      });
    }
  }

  const failedInspections = inspectionRecords.filter(r => r.passed === false);
  if (failedInspections.length > 0) {
    const recentFailed = failedInspections.filter(r =>
      Date.now() - r.timestamp < 7 * 24 * 60 * 60 * 1000
    );
    if (recentFailed.length > 0) {
      score += recentFailed.length * 5;
      riskFactors.push({
        code: 'recent_failed_inspections',
        name: '近期安全检查未通过',
        failedCount: recentFailed.length,
        riskScore: recentFailed.length * 5
      });
    }
  }

  return { score, riskFactors };
}

function calculateUsageHabitRisk(userId) {
  const uid = normalizeUserId(userId);
  const events = storage.getBurningEvents({ userId: uid });
  const igniteEvents = events.filter(e => e.eventType === 'ignite');
  const extinguishEvents = events.filter(e => e.eventType === 'extinguish');

  let score = 0;
  const riskFactors = [];

  const nightIgnitions = igniteEvents.filter(e => {
    const hour = new Date(e.timestamp).getHours();
    return hour >= 22 || hour < 6;
  });

  if (igniteEvents.length > 0) {
    const nightIgnitionRate = nightIgnitions.length / igniteEvents.length;
    if (nightIgnitionRate > 0.3) {
      score += 12;
      riskFactors.push({
        code: 'frequent_night_burning',
        name: '频繁夜间燃烧',
        nightCount: nightIgnitions.length,
        totalCount: igniteEvents.length,
        rate: Number((nightIgnitionRate * 100).toFixed(1)),
        riskScore: 12
      });
    }
  }

  const unextinguishedSessions = [];
  const processedCandles = new Set();

  for (const ignite of igniteEvents) {
    if (processedCandles.has(ignite.candleId)) continue;

    const candleExtinguishes = extinguishEvents.filter(e => e.candleId === ignite.candleId);
    const lastIgnite = igniteEvents
      .filter(e => e.candleId === ignite.candleId)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    const lastExtinguish = candleExtinguishes.length > 0
      ? candleExtinguishes.sort((a, b) => b.timestamp - a.timestamp)[0]
      : null;

    if (lastIgnite && (!lastExtinguish || lastExtinguish.timestamp < lastIgnite.timestamp)) {
      const duration = (Date.now() - lastIgnite.timestamp) / (1000 * 60 * 60);
      if (duration > 8) {
        unextinguishedSessions.push({
          candleId: ignite.candleId,
          durationHours: Number(duration.toFixed(1))
        });
      }
    }
    processedCandles.add(ignite.candleId);
  }

  if (unextinguishedSessions.length > 0) {
    score += 20;
    riskFactors.push({
      code: 'unattended_burning',
      name: '疑似无人看管燃烧',
      sessions: unextinguishedSessions,
      riskScore: 20
    });
  }

  return { score, riskFactors };
}

function assessBurningRisk(userId, candleId, environment = {}) {
  const uid = normalizeUserId(userId);
  const candle = candleId ? storage.getCandleById(candleId) : null;
  const activeSession = candleId ? storage.getActiveBurningSession(uid, candleId) : null;
  const roomCode = environment.roomCode || activeSession?.roomCode;

  const allRiskFactors = [];
  let totalScore = 0;

  const candleRisk = calculateCandleRiskScore(candle);
  if (candleRisk > 0) {
    totalScore += candleRisk;
    allRiskFactors.push({
      category: 'candle',
      name: '蜡烛属性风险',
      score: candleRisk,
      details: candle ? {
        waxType: candle.waxType,
        wickSize: candle.wickSize,
        capacity: candle.capacity
      } : null
    });
  }

  const envRisk = calculateEnvironmentRiskScore(environment, roomCode);
  totalScore += envRisk.baseScore;
  allRiskFactors.push(...envRisk.riskFactors.map(f => ({ ...f, category: 'environment' })));

  const burnRisk = calculateContinuousBurnRisk(activeSession, environment.burningHours);
  totalScore += burnRisk.score;
  allRiskFactors.push(...burnRisk.riskFactors.map(f => ({ ...f, category: 'continuous_burn' })));

  const historicalRisk = calculateHistoricalRiskScore(uid);
  totalScore += historicalRisk.score;
  allRiskFactors.push(...historicalRisk.riskFactors.map(f => ({ ...f, category: 'historical' })));

  const habitRisk = calculateUsageHabitRisk(uid);
  totalScore += habitRisk.score;
  allRiskFactors.push(...habitRisk.riskFactors.map(f => ({ ...f, category: 'usage_habit' })));

  totalScore = Math.min(100, Math.max(0, totalScore));
  const riskLevel = storage.getSafetyRiskLevelByScore(totalScore);

  const specialAlerts = {
    childAlert: allRiskFactors.some(f => f.code === 'child_presence'),
    petAlert: allRiskFactors.some(f => f.code === 'pet_presence'),
    ventilationAlert: allRiskFactors.some(f =>
      f.code === 'poor_ventilation' || f.code === 'ventilation_insufficient'
    ),
    longBurnAlert: allRiskFactors.some(f =>
      f.code === 'exceeded_max_burn_time' || f.code === 'approaching_max_burn_time'
    )
  };

  const suggestions = generateSafetySuggestions(totalScore, allRiskFactors, specialAlerts);
  const shouldContinueBurning = totalScore < 60;
  const reasons = generateRiskReasons(totalScore, allRiskFactors, riskLevel);

  return {
    userId: uid,
    candleId,
    riskScore: totalScore,
    riskLevel: riskLevel?.level || 'safe',
    riskLevelName: riskLevel?.name || '安全',
    riskLevelColor: riskLevel?.color || 'green',
    description: riskLevel?.description || '',
    timePeriod: envRisk.timePeriod,
    activeSession,
    riskBreakdown: {
      candleRisk,
      environmentRisk: envRisk.baseScore,
      continuousBurnRisk: burnRisk.score,
      historicalRisk: historicalRisk.score,
      usageHabitRisk: habitRisk.score
    },
    riskFactors: allRiskFactors,
    specialAlerts,
    riskReasons: reasons,
    correctiveActions: suggestions.correctiveActions,
    safetyTips: suggestions.safetyTips,
    shouldContinueBurning,
    recommendation: shouldContinueBurning
      ? '可以继续燃烧，但请注意观察'
      : '建议立即熄灭蜡烛，消除安全隐患后再使用',
    lastUpdated: Date.now()
  };
}

function generateRiskReasons(totalScore, riskFactors, riskLevel) {
  const reasons = [];

  if (totalScore >= 80) {
    reasons.push('当前风险极高，存在严重安全隐患');
  } else if (totalScore >= 60) {
    reasons.push('当前风险较高，建议立即采取措施');
  } else if (totalScore >= 40) {
    reasons.push('存在多项安全风险因素，需要关注');
  } else if (totalScore >= 20) {
    reasons.push('存在轻微风险因素，建议留意');
  } else {
    reasons.push('当前燃烧环境良好，风险较低');
  }

  const topFactors = riskFactors
    .filter(f => f.riskScore > 0)
    .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0))
    .slice(0, 3);

  topFactors.forEach(f => {
    if (f.name) {
      reasons.push(`${f.name}（风险分值：${f.riskScore}）`);
    }
  });

  return reasons;
}

function generateSafetySuggestions(totalScore, riskFactors, specialAlerts) {
  const correctiveActions = [];
  const safetyTips = [];

  riskFactors.forEach(f => {
    switch (f.code) {
      case 'high_temperature':
        correctiveActions.push('将蜡烛移至温度较低的区域，避免阳光直射或靠近热源');
        break;
      case 'low_humidity':
        correctiveActions.push('使用加湿器增加空气湿度，或在蜡烛旁放置一杯水');
        break;
      case 'combustible_too_close':
        correctiveActions.push(`立即将蜡烛移至距离可燃物至少${f.threshold}${f.unit}以外的位置`);
        break;
      case 'ventilation_insufficient':
        correctiveActions.push('确保蜡烛周围有足够的通风空间，与墙壁保持适当距离');
        break;
      case 'child_presence':
        correctiveActions.push('将蜡烛放置在儿童无法触及的高处，或使用烛台防护罩');
        safetyTips.push('儿童在场时请全程看管蜡烛，切勿让儿童独自靠近');
        break;
      case 'pet_presence':
        correctiveActions.push('将蜡烛放置在宠物无法触碰的位置，考虑使用防宠物烛台');
        safetyTips.push('宠物在场时请密切关注，防止宠物碰倒蜡烛');
        break;
      case 'poor_ventilation':
        correctiveActions.push('打开门窗保持通风，避免在密闭空间长时间燃烧');
        safetyTips.push('密闭空间燃烧可能导致一氧化碳积聚，请确保通风良好');
        break;
      case 'exceeded_max_burn_time':
        correctiveActions.push(`已连续燃烧${f.actual}小时，建议立即熄灭，冷却2小时后再点燃`);
        break;
      case 'approaching_max_burn_time':
        correctiveActions.push(`已燃烧${f.actual}小时，接近建议的${f.threshold}小时上限，请准备熄灭`);
        break;
      case 'high_risk_room':
        if (f.roomCode === 'bedroom') {
          safetyTips.push('卧室内燃烧蜡烛请特别注意，入睡前务必确认已完全熄灭');
        } else if (f.roomCode === 'kitchen') {
          safetyTips.push('厨房内可燃物较多，请将蜡烛远离灶台、窗帘等物品');
        }
        break;
      case 'high_risk_time':
        if (f.timePeriod === 'night') {
          correctiveActions.push('深夜时段建议熄灭蜡烛，避免睡眠时无人看管');
        }
        break;
      case 'frequent_anomalies':
        correctiveActions.push('频繁出现异常燃烧，建议检查烛芯修剪和放置位置');
        safetyTips.push('每次点燃前修剪烛芯至5mm，确保蜡面平整');
        break;
      case 'recent_failed_inspections':
        correctiveActions.push('近期安全检查未通过，请逐项整改后再使用');
        break;
      case 'frequent_night_burning':
        correctiveActions.push('减少夜间燃烧频率，考虑使用其他无火香薰产品');
        break;
      case 'unattended_burning':
        correctiveActions.push('存在长时间无人看管的燃烧记录，请养成人走灯灭的习惯');
        break;
    }
  });

  if (specialAlerts?.childAlert) {
    safetyTips.push('儿童安全专项：建议将火柴、打火机等点火工具锁好存放');
    safetyTips.push('教育儿童不要玩火，告知蜡烛的危险性');
  }

  if (specialAlerts?.petAlert) {
    safetyTips.push('宠物安全专项：不要让宠物在燃烧的蜡烛附近跳跃或玩耍');
    safetyTips.push('考虑使用带防护罩的烛台，防止宠物碰翻');
  }

  if (specialAlerts?.ventilationAlert) {
    safetyTips.push('通风安全专项：建议安装一氧化碳报警器，定期检查通风系统');
  }

  if (specialAlerts?.longBurnAlert) {
    safetyTips.push('长时间燃烧专项：设置定时器提醒，每次燃烧不超过4小时');
    safetyTips.push('长时间燃烧后让蜡烛冷却至少2小时再重新点燃');
  }

  safetyTips.push('每次使用前修剪烛芯至5mm长度');
  safetyTips.push('确保蜡烛放置在平稳、不可燃的表面上');
  safetyTips.push('切勿在无人看管的情况下让蜡烛燃烧');
  safetyTips.push('熄灭蜡烛时使用烛钩或灭烛罩，避免吹灭产生黑烟');

  return {
    correctiveActions: [...new Set(correctiveActions)],
    safetyTips: [...new Set(safetyTips)]
  };
}

function generateUserSafetyProfile(userId) {
  const uid = normalizeUserId(userId);

  const burningRecords = storage.getBurningRecords({ userId: uid });
  const inspectionRecords = storage.getSafetyInspectionRecords({ userId: uid });
  const burningEvents = storage.getBurningEvents({ userId: uid });
  const inventory = storage.getAvailableInventoryCandles(uid);

  if (burningRecords.length === 0 && inspectionRecords.length === 0 && burningEvents.length === 0) {
    return {
      userId: uid,
      profileStatus: 'insufficient_data',
      message: '用户安全数据不足，请先上报燃烧记录和安全检查以生成安全画像',
      lastUpdated: Date.now()
    };
  }

  const overallAssessment = assessBurningRisk(uid, null, {});
  const historicalRisk = calculateHistoricalRiskScore(uid);
  const habitRisk = calculateUsageHabitRisk(uid);

  const totalSessions = Math.max(
    burningRecords.length,
    burningEvents.filter(e => e.eventType === 'ignite').length
  );
  const totalInspections = inspectionRecords.length;
  const passedInspections = inspectionRecords.filter(r => r.passed === true).length;
  const inspectionPassRate = totalInspections > 0
    ? Number((passedInspections / totalInspections * 100).toFixed(1))
    : null;

  const anomalyRecords = burningRecords.filter(r =>
    consumptionService.detectAnomaly(r).length > 0
  );
  const anomalyRate = burningRecords.length > 0
    ? Number((anomalyRecords.length / burningRecords.length * 100).toFixed(1))
    : null;

  const totalBurningHoursFromRecords = burningRecords.reduce((sum, r) => sum + (r.burnHours || 0), 0);
  const totalBurningHoursFromEvents = burningEvents.filter(e => e.eventType === 'extinguish' && e.burnHours)
    .reduce((sum, e) => sum + (e.burnHours || 0), 0);
  const totalBurningHoursCombined = totalBurningHoursFromRecords + totalBurningHoursFromEvents;

  const roomUsage = {};
  burningRecords.forEach(r => {
    if (r.scene) {
      if (!roomUsage[r.scene]) roomUsage[r.scene] = { count: 0, totalHours: 0 };
      roomUsage[r.scene].count++;
      roomUsage[r.scene].totalHours += r.burnHours || 0;
    }
  });
  burningEvents.forEach(e => {
    if (e.roomCode && e.burnHours) {
      if (!roomUsage[e.roomCode]) roomUsage[e.roomCode] = { count: 0, totalHours: 0 };
      roomUsage[e.roomCode].count++;
      roomUsage[e.roomCode].totalHours += e.burnHours || 0;
    }
  });

  const avgSessionHours = totalSessions > 0
    ? totalBurningHoursCombined / totalSessions
    : null;

  const candleSafetySummary = inventory.map(item => ({
    candleId: item.candle.id,
    brand: item.candle.brand,
    name: item.candle.name,
    waxType: item.candle.waxType,
    wickSize: item.candle.wickSize,
    capacity: item.candle.capacity,
    quantity: item.quantity,
    safetyScore: calculateCandleRiskScore(item.candle)
  }));

  const safetyScore = overallAssessment.riskScore;
  const reversedScore = Math.max(0, 100 - safetyScore);
  const overallSafetyLevel = storage.getSafetyRiskLevelByScore(safetyScore);
  const safetyLevelMapping = {
    'safe': { level: 'excellent', name: '优秀' },
    'caution': { level: 'good', name: '良好' },
    'warning': { level: 'fair', name: '一般' },
    'danger': { level: 'poor', name: '较差' },
    'critical': { level: 'critical', name: '危险' }
  };
  const mappedLevel = safetyLevelMapping[overallSafetyLevel?.level] || { level: 'good', name: '良好' };

  const profile = {
    userId: uid,
    profileStatus: 'complete',
    overallSafetyScore: reversedScore,
    overallSafetyLevel: mappedLevel.level,
    overallSafetyLevelName: mappedLevel.name,
    riskScore: safetyScore,
    riskLevel: overallSafetyLevel?.level || 'safe',
    riskLevelName: overallSafetyLevel?.name || '安全',
    safetyScoreTrend: analyzeSafetyTrend(uid),
    summary: {
      totalBurningSessions: totalSessions,
      totalBurningHours: Number(totalBurningHoursCombined.toFixed(1)),
      totalSafetyInspections: totalInspections,
      inspectionPassRate,
      anomalyRate,
      averageSessionHours: avgSessionHours ? Number(avgSessionHours.toFixed(1)) : null
    },
    riskBreakdown: overallAssessment.riskBreakdown,
    historicalRiskFactors: historicalRisk.riskFactors,
    habitRiskFactors: habitRisk.riskFactors,
    roomUsageStats: Object.entries(roomUsage).map(([room, stats]) => ({
      roomCode: room,
      usageCount: stats.count,
      totalBurnHours: Number(stats.totalHours.toFixed(1)),
      riskMultiplier: getRoomTypeMultiplier(room)
    })),
    candleSafetySummary,
    recommendations: generateSafetyImprovementPlan(overallAssessment.riskFactors),
    lastUpdated: Date.now()
  };

  storage.saveUserSafetyProfile(uid, profile);
  return profile;
}

function analyzeSafetyTrend(userId) {
  const uid = normalizeUserId(userId);
  const records = storage.getSafetyInspectionRecords({ userId: uid });

  if (records.length < 3) {
    return {
      trend: 'insufficient_data',
      message: '数据不足，无法分析趋势'
    };
  }

  const sorted = records.sort((a, b) => a.timestamp - b.timestamp);
  const recent = sorted.slice(-3);
  const earlier = sorted.slice(0, -3);

  const recentPassRate = recent.filter(r => r.passed === true).length / recent.length;
  const earlierPassRate = earlier.length > 0
    ? earlier.filter(r => r.passed === true).length / earlier.length
    : recentPassRate;

  let trend = 'stable';
  if (recentPassRate > earlierPassRate + 0.1) trend = 'improving';
  else if (recentPassRate < earlierPassRate - 0.1) trend = 'declining';

  return {
    trend,
    recentPassRate: Number((recentPassRate * 100).toFixed(1)),
    earlierPassRate: Number((earlierPassRate * 100).toFixed(1)),
    dataPoints: records.length
  };
}

function generateSafetyImprovementPlan(riskFactors) {
  const highPriority = [];
  const mediumPriority = [];
  const lowPriority = [];

  riskFactors.forEach(f => {
    const score = f.riskScore || 0;
    if (score >= 20) {
      highPriority.push({
        factor: f.name,
        riskScore: score,
        action: `优先处理：${f.name}`,
        timeline: '立即处理'
      });
    } else if (score >= 10) {
      mediumPriority.push({
        factor: f.name,
        riskScore: score,
        action: `计划改进：${f.name}`,
        timeline: '1周内处理'
      });
    } else if (score > 0) {
      lowPriority.push({
        factor: f.name,
        riskScore: score,
        action: `持续关注：${f.name}`,
        timeline: '1个月内改进'
      });
    }
  });

  return {
    highPriority,
    mediumPriority,
    lowPriority
  };
}

function generateRoomSafetyAlert(userId, roomCode) {
  const uid = normalizeUserId(userId);

  const scenario = storage.getUsageScenarioByCode(roomCode);
  if (!scenario) {
    return {
      error: 'INVALID_ROOM_CODE',
      message: `房间代码 "${roomCode}" 无效，请使用有效的房间代码`,
      validRoomCodes: storage.getUsageScenarios().map(s => ({ code: s.code, name: s.name }))
    };
  }

  const roomEnv = storage.getRoomEnvironment(uid, roomCode);
  const roomBurningRecords = storage.getBurningRecords({ userId: uid, scene: roomCode });
  const activeSessions = storage.getActiveBurningSessionsByRoom(uid, roomCode);

  const currentEnv = {
    ...roomEnv,
    roomCode
  };

  const primarySession = activeSessions.length > 0 ? activeSessions[0] : null;
  const assessment = assessBurningRisk(uid, primarySession?.candleId, currentEnv);

  const alerts = [];

  if (assessment.riskScore >= 60) {
    alerts.push({
      alertType: 'high_risk',
      severity: 'critical',
      title: `${scenario.name}安全风险告警`,
      message: `当前房间风险评分${assessment.riskScore}分，属于${assessment.riskLevelName}级别`,
      immediateAction: assessment.recommendation
    });
  }

  if (assessment.specialAlerts.childAlert) {
    alerts.push({
      alertType: 'child_safety',
      severity: 'high',
      title: '儿童安全专项告警',
      message: '检测到儿童在场，请确保蜡烛放置在儿童无法触及的位置',
      immediateAction: '将蜡烛移至高处或使用防护罩，全程看管'
    });
  }

  if (assessment.specialAlerts.petAlert) {
    alerts.push({
      alertType: 'pet_safety',
      severity: 'high',
      title: '宠物安全专项告警',
      message: '检测到宠物在场，请防止宠物碰倒蜡烛',
      immediateAction: '将蜡烛放置在宠物无法触碰的位置'
    });
  }

  if (assessment.specialAlerts.ventilationAlert) {
    alerts.push({
      alertType: 'ventilation',
      severity: 'medium',
      title: '通风安全告警',
      message: '当前房间通风条件不佳，存在一氧化碳积聚风险',
      immediateAction: '打开门窗增加通风，或转移至通风良好的区域'
    });
  }

  if (assessment.specialAlerts.longBurnAlert) {
    alerts.push({
      alertType: 'long_burning',
      severity: 'medium',
      title: '长时间燃烧告警',
      message: '连续燃烧时间过长，蜡池温度可能过高',
      immediateAction: '建议立即熄灭，冷却后再使用'
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      alertType: 'safe',
      severity: 'low',
      title: `${scenario.name}安全状态良好`,
      message: '当前环境安全，可正常使用蜡烛',
      immediateAction: '继续保持良好的使用习惯'
    });
  }

  const storedAlerts = alerts.map(a =>
    storage.addSafetyAlert({ ...a, roomCode, riskScore: assessment.riskScore }, uid)
  );

  return {
    userId: uid,
    roomCode,
    roomName: scenario.name,
    riskScore: assessment.riskScore,
    riskLevel: assessment.riskLevel,
    riskLevelName: assessment.riskLevelName,
    isBurningInRoom: activeSessions.length > 0,
    activeBurningSessions: activeSessions,
    activeSessionCount: activeSessions.length,
    primarySession,
    alerts: storedAlerts,
    safetySuggestions: assessment.safetyTips.slice(0, 5),
    lastUpdated: Date.now()
  };
}

function submitSafetyInspection(userId, inspectionData) {
  const uid = normalizeUserId(userId);

  const record = storage.addSafetyInspectionRecord(inspectionData, uid);

  if (inspectionData.candleId) {
    storage.saveRoomEnvironment(uid, inspectionData.roomCode || 'default', {
      temperature: inspectionData.temperature,
      humidity: inspectionData.humidity,
      combustibleDistance: inspectionData.combustibleDistance,
      ventilationDistance: inspectionData.ventilationDistance,
      hasChild: inspectionData.hasChild,
      hasPet: inspectionData.hasPet,
      isPoorVentilation: inspectionData.isPoorVentilation,
      wickLength: inspectionData.wickLength
    });
  }

  const assessment = assessBurningRisk(uid, inspectionData.candleId, {
    roomCode: inspectionData.roomCode,
    temperature: inspectionData.temperature,
    humidity: inspectionData.humidity,
    combustibleDistance: inspectionData.combustibleDistance,
    ventilationDistance: inspectionData.ventilationDistance,
    hasChild: inspectionData.hasChild,
    hasPet: inspectionData.hasPet,
    isPoorVentilation: inspectionData.isPoorVentilation
  });

  return {
    userId: uid,
    inspectionRecord: record,
    riskAssessment: assessment,
    lastUpdated: Date.now()
  };
}

function reportBurningEvent(userId, eventData) {
  const uid = normalizeUserId(userId);

  const event = storage.addBurningEvent(eventData, uid);

  if (eventData.eventType === 'ignite' && eventData.roomCode) {
    storage.saveRoomEnvironment(uid, eventData.roomCode, {
      temperature: eventData.temperature,
      humidity: eventData.humidity
    });
  }

  let assessment = null;
  if (eventData.eventType === 'ignite' || eventData.eventType === 'extinguish') {
    assessment = assessBurningRisk(uid, eventData.candleId, {
      roomCode: eventData.roomCode,
      temperature: eventData.temperature,
      humidity: eventData.humidity
    });
  }

  return {
    userId: uid,
    event,
    riskAssessment: assessment,
    lastUpdated: Date.now()
  };
}

module.exports = {
  assessBurningRisk,
  generateUserSafetyProfile,
  generateRoomSafetyAlert,
  submitSafetyInspection,
  reportBurningEvent,
  calculateCandleRiskScore,
  calculateEnvironmentRiskScore,
  calculateContinuousBurnRisk,
  calculateHistoricalRiskScore,
  calculateUsageHabitRisk,
  getCurrentTimePeriod,
  generateSafetySuggestions
};
