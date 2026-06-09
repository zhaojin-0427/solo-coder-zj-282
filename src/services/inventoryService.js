const storage = require('../storage/memoryStorage');
const consumptionService = require('./consumptionService');

const WARNING_DAYS = 7;
const REPLENISH_THRESHOLD_DAYS = 14;

function predictInventoryDays(inventoryItem, model) {
  if (!model || !model.actualBurnRate || !model.usagePattern) {
    return null;
  }

  const usage = model.usagePattern;
  const dailyConsumptionHours = usage.averageSessionHours *
    (usage.frequency === 'frequent' ? 0.7 :
     usage.frequency === 'regular' ? 0.4 : 0.2);

  const dailyBurnedGrams = dailyConsumptionHours * model.actualBurnRate;
  const totalAvailableGrams = inventoryItem.quantity * inventoryItem.capacity;
  const availableDays = totalAvailableGrams / dailyBurnedGrams;

  return {
    availableDays: Math.floor(availableDays),
    dailyConsumptionGrams: Number(dailyBurnedGrams.toFixed(2)),
    dailyConsumptionHours: Number(dailyConsumptionHours.toFixed(2)),
    totalAvailableGrams: Number(totalAvailableGrams.toFixed(1)),
    status: availableDays <= WARNING_DAYS ? 'urgent' :
            availableDays <= REPLENISH_THRESHOLD_DAYS ? 'warning' : 'normal'
  };
}

function getInventoryPrediction() {
  const inventory = storage.getInventory();
  const predictions = [];

  inventory.forEach(item => {
    const candle = storage.getCandleByBrandAndCapacity(item.brand, item.capacity);
    if (!candle) return;

    const model = storage.getConsumptionModel(candle.id);
    const prediction = predictInventoryDays(item, model);
    const predictionData = {
      id: item.id,
      brand: item.brand,
      capacity: item.capacity,
      quantity: item.quantity,
      price: candle.price,
      prediction: prediction || null,
      warningDays: WARNING_DAYS,
      lastUpdated: item.lastUpdated
    };

    if (prediction && prediction.status === 'urgent') {
      predictionData.replenishSuggestion = generateReplenishSuggestion(item, candle, model, prediction);
    }

    predictions.push(predictionData);
  });

  return predictions;
}

function generateReplenishSuggestion(inventoryItem, candle, model, prediction) {
  const usage = model.usagePattern;
  const monthlyConsumption = usage.averageSessionHours *
    (usage.frequency === 'frequent' ? 30 :
     usage.frequency === 'regular' ? 15 : 8) *
    model.actualBurnRate;

  const recommendedQuantity = Math.ceil(monthlyConsumption / candle.capacity) + 1;

  return {
    recommendedQuantity,
    estimatedMonthlyUsage: Number(monthlyConsumption.toFixed(1)),
    unit: 'g',
    urgency: prediction.status,
    message: `库存仅剩 ${Math.floor(prediction.availableDays)} 天，建议补货 ${recommendedQuantity} 个`
  };
}

function getReplenishmentAdvice() {
  const predictions = getInventoryPrediction();
  const brandEfficiencies = consumptionService.getBrandEfficiency();

  const urgentItems = predictions.filter(p => p.prediction && p.prediction.status === 'urgent');
  const warningItems = predictions.filter(p => p.prediction && p.prediction.status === 'warning');

  const valueRecommendations = getValueRecommendations(brandEfficiencies);

  return {
    urgentItems,
    warningItems,
    totalInventoryValue: calculateTotalInventoryValue(predictions),
    valueRecommendations,
    summary: {
      urgentCount: urgentItems.length,
      warningCount: warningItems.length,
      normalCount: predictions.length - urgentItems.length - warningItems.length
    }
  };
}

function getValueRecommendations(brandEfficiencies) {
  const validEfficiencies = brandEfficiencies.filter(e => e.valueScore !== null);
  const sorted = validEfficiencies.sort((a, b) => parseFloat(b.valueScore) - parseFloat(a.valueScore));
  return sorted.slice(0, 3).map(e => ({
    brand: e.brand,
    valueScore: e.valueScore,
    price: e.price,
    capacity: e.capacity,
    estimatedTotalHours: e.estimatedTotalHours,
    recommendation: `性价比评分 ${e.valueScore}，推荐作为日常使用`
  }));
}

function calculateTotalInventoryValue(predictions) {
  return predictions.reduce((sum, p) => sum + (p.quantity * p.price), 0);
}

function getLowInventoryAlerts() {
  const predictions = getInventoryPrediction();
  return predictions.filter(p =>
    p.prediction && p.prediction.availableDays <= WARNING_DAYS
  ).map(p => ({
    brand: p.brand,
    availableDays: p.prediction.availableDays,
    quantity: p.quantity,
    warningLevel: p.prediction.availableDays <= 3 ? 'critical' : 'warning'
  }));
}

module.exports = {
  predictInventoryDays,
  getInventoryPrediction,
  getReplenishmentAdvice,
  getLowInventoryAlerts,
  WARNING_DAYS,
  REPLENISH_THRESHOLD_DAYS
};
