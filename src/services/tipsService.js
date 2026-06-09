const { storage, DEFAULT_USER_ID } = require('../storage/memoryStorage');

function getTipsForAnomalies(anomalies) {
  const tips = [];
  const tipTypes = new Set();

  anomalies.forEach(anomaly => {
    if (!tipTypes.has(anomaly.type)) {
      tipTypes.add(anomaly.type);
      const matchingTips = storage.getTipsByType(anomaly.type);
      tips.push(...matchingTips);
    }
  });

  if (tips.length === 0) {
    tips.push(...storage.getTipsByType('efficiency'));
  }

  return tips;
}

function getTipsByUsagePattern(usagePattern) {
  const tips = [];
  if (!usagePattern) return tips;

  if (usagePattern.sessionLength === 'long') {
    const tip = storage.getTipsByType('tunneling');
    tips.push(...tip);
  }

  if (usagePattern.frequency === 'frequent') {
    const tip = storage.getTipsByType('smoke');
    tips.push(...tip);
  }

  return tips;
}

function getPersonalizedTips(candleId, userId) {
  const uid = userId || DEFAULT_USER_ID;
  const model = storage.getConsumptionModel(candleId, uid);
  const tips = [];

  if (!model) return { tips: [], message: '暂无个性化建议，继续使用以积累数据' };

  const usageTips = getTipsByUsagePattern(model.usagePattern);
  tips.push(...usageTips);

  if (model.efficiency && parseFloat(model.efficiency) < 85) {
    const efficiencyTips = storage.getTipsByType('efficiency');
    tips.push(...efficiencyTips);
  }

  return {
    tips,
    message: tips.length > 0
      ? `根据您的使用习惯，有 ${tips.length} 条优化建议`
      : '您的使用习惯很好，继续保持！'
  };
}

function getPersonalizedTipsForUser(userId) {
  const uid = userId || DEFAULT_USER_ID;
  const models = storage.getAllConsumptionModels(uid);
  const allTips = [];
  const tipIds = new Set();

  models.forEach(model => {
    const result = getPersonalizedTips(model.candleId, uid);
    result.tips.forEach(tip => {
      if (!tipIds.has(tip.id)) {
        tipIds.add(tip.id);
        allTips.push(tip);
      }
    });
  });

  const records = storage.getBurningRecords({ userId: uid });
  const recentRecords = records.slice(-10);
  recentRecords.forEach(record => {
    const anomalies = require('./consumptionService').detectAnomaly(record);
    if (anomalies.length > 0) {
      const anomalyTips = getTipsForAnomalies(anomalies);
      anomalyTips.forEach(tip => {
        if (!tipIds.has(tip.id)) {
          tipIds.add(tip.id);
          allTips.push(tip);
        }
      });
    }
  });

  return {
    userId: uid,
    tips: allTips,
    modelCount: models.length,
    analyzedRecords: recentRecords.length,
    message: allTips.length > 0
      ? `基于您的使用画像，有 ${allTips.length} 条专属优化建议`
      : '您的使用习惯很好，继续保持！'
  };
}

function getTipsByType(type) {
  return storage.getTipsByType(type);
}

function getAllTips() {
  return [...storage.tips];
}

module.exports = {
  getTipsForAnomalies,
  getTipsByUsagePattern,
  getPersonalizedTips,
  getPersonalizedTipsForUser,
  getTipsByType,
  getAllTips
};
