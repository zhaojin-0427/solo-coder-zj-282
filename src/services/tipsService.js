const storage = require('../storage/memoryStorage');

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

function getPersonalizedTips(candleId) {
  const model = storage.getConsumptionModel(candleId);
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

function getTipsByType(type) {
  return storage.getTipsByType(type);
}

function getAllTips() {
  return storage.getAllTips();
}

module.exports = {
  getTipsForAnomalies,
  getTipsByUsagePattern,
  getPersonalizedTips,
  getTipsByType,
  getAllTips
};
