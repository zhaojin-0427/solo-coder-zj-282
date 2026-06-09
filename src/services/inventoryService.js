const storage = require('../storage/memoryStorage');
const consumptionService = require('./consumptionService');
const { parsePositiveInteger, parseNumber } = require('../utils/validator');

const WARNING_DAYS = 7;
const REPLENISH_THRESHOLD_DAYS = 14;

function _sanitizeInventoryItem(item) {
  if (!item) return null;
  const quantity = parsePositiveInteger(item.quantity);
  const capacity = parsePositiveInteger(item.capacity);
  if (quantity === null || capacity === null) {
    return null;
  }
  return {
    ...item,
    quantity,
    capacity
  };
}

function _isValidPredictionInput(inventoryItem, model) {
  if (!inventoryItem || typeof inventoryItem.quantity !== 'number' || isNaN(inventoryItem.quantity) || inventoryItem.quantity < 0) {
    return false;
  }
  if (typeof inventoryItem.capacity !== 'number' || isNaN(inventoryItem.capacity) || inventoryItem.capacity <= 0) {
    return false;
  }
  if (!model || !model.actualBurnRate || !model.usagePattern) {
    return false;
  }
  if (typeof model.actualBurnRate !== 'number' || isNaN(model.actualBurnRate) || model.actualBurnRate <= 0) {
    return false;
  }
  return true;
}

function predictInventoryDays(inventoryItem, model) {
  const cleanedItem = _sanitizeInventoryItem(inventoryItem);
  if (!cleanedItem || !_isValidPredictionInput(cleanedItem, model)) {
    return null;
  }

  const usage = model.usagePattern;
  if (!usage || typeof usage.averageSessionHours !== 'number' || usage.averageSessionHours <= 0) {
    return null;
  }

  const dailyConsumptionHours = usage.averageSessionHours *
    (usage.frequency === 'frequent' ? 0.7 :
     usage.frequency === 'regular' ? 0.4 : 0.2);

  if (dailyConsumptionHours <= 0) {
    return null;
  }

  const dailyBurnedGrams = dailyConsumptionHours * model.actualBurnRate;
  const totalAvailableGrams = cleanedItem.quantity * cleanedItem.capacity;
  const availableDays = totalAvailableGrams / dailyBurnedGrams;

  if (!isFinite(availableDays) || availableDays < 0) {
    return null;
  }

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
  const errors = [];

  inventory.forEach((item, index) => {
    const cleanedItem = _sanitizeInventoryItem(item);
    if (!cleanedItem) {
      errors.push(`库存项 ${index + 1} 数据异常，已跳过`);
      return;
    }

    const candle = storage.getCandleByBrandAndCapacity(cleanedItem.brand, cleanedItem.capacity);
    if (!candle) {
      errors.push(`未找到品牌 ${cleanedItem.brand} 容量 ${cleanedItem.capacity} 的蜡烛信息`);
      return;
    }

    const model = storage.getConsumptionModel(candle.id);
    const prediction = predictInventoryDays(cleanedItem, model);

    const predictionData = {
      id: cleanedItem.id,
      brand: cleanedItem.brand,
      capacity: cleanedItem.capacity,
      quantity: cleanedItem.quantity,
      price: candle.price,
      prediction: prediction || null,
      warningDays: WARNING_DAYS,
      lastUpdated: cleanedItem.lastUpdated,
      dataValid: true
    };

    if (prediction && prediction.status === 'urgent') {
      const suggestion = generateReplenishSuggestion(cleanedItem, candle, model, prediction);
      if (suggestion) {
        predictionData.replenishSuggestion = suggestion;
      }
    }

    predictions.push(predictionData);
  });

  return {
    predictions,
    errors,
    validCount: predictions.length,
    invalidCount: inventory.length - predictions.length
  };
}

function generateReplenishSuggestion(inventoryItem, candle, model, prediction) {
  if (!inventoryItem || !candle || !model || !prediction) {
    return null;
  }

  const usage = model.usagePattern;
  if (!usage || typeof usage.averageSessionHours !== 'number' || usage.averageSessionHours <= 0) {
    return null;
  }
  if (typeof model.actualBurnRate !== 'number' || model.actualBurnRate <= 0) {
    return null;
  }
  if (typeof candle.capacity !== 'number' || candle.capacity <= 0) {
    return null;
  }

  const monthlyConsumption = usage.averageSessionHours *
    (usage.frequency === 'frequent' ? 30 :
     usage.frequency === 'regular' ? 15 : 8) *
    model.actualBurnRate;

  if (!isFinite(monthlyConsumption) || monthlyConsumption < 0) {
    return null;
  }

  const recommendedQuantity = Math.ceil(monthlyConsumption / candle.capacity) + 1;

  if (!isFinite(prediction.availableDays) || prediction.availableDays < 0) {
    return null;
  }

  return {
    recommendedQuantity,
    estimatedMonthlyUsage: Number(monthlyConsumption.toFixed(1)),
    unit: 'g',
    urgency: prediction.status,
    message: `库存仅剩 ${Math.floor(prediction.availableDays)} 天，建议补货 ${recommendedQuantity} 个`
  };
}

function getReplenishmentAdvice() {
  const result = getInventoryPrediction();
  const predictions = result.predictions;
  const brandEfficiencies = consumptionService.getBrandEfficiency();

  const urgentItems = predictions.filter(p => p.prediction && p.prediction.status === 'urgent');
  const warningItems = predictions.filter(p => p.prediction && p.prediction.status === 'warning');

  const valueRecommendations = getValueRecommendations(brandEfficiencies);

  return {
    urgentItems,
    warningItems,
    totalInventoryValue: calculateTotalInventoryValue(predictions),
    valueRecommendations,
    dataErrors: result.errors,
    validCount: result.validCount,
    invalidCount: result.invalidCount,
    summary: {
      urgentCount: urgentItems.length,
      warningCount: warningItems.length,
      normalCount: predictions.filter(p => !p.prediction || p.prediction.status === 'normal').length,
      invalidCount: result.invalidCount
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
  if (!Array.isArray(predictions)) return 0;
  return predictions.reduce((sum, p) => {
    const qty = parsePositiveInteger(p && p.quantity);
    const price = parseNumber(p && p.price);
    if (qty === null || price === null) return sum;
    return sum + (qty * price);
  }, 0);
}

function getLowInventoryAlerts() {
  const result = getInventoryPrediction();
  const alerts = result.predictions.filter(p =>
    p.prediction && p.prediction.availableDays <= WARNING_DAYS
  ).map(p => ({
    brand: p.brand,
    availableDays: p.prediction.availableDays,
    quantity: p.quantity,
    warningLevel: p.prediction.availableDays <= 3 ? 'critical' : 'warning'
  }));

  return {
    alerts,
    dataErrors: result.errors,
    validCount: result.validCount,
    invalidCount: result.invalidCount
  };
}

module.exports = {
  predictInventoryDays,
  getInventoryPrediction,
  getReplenishmentAdvice,
  getLowInventoryAlerts,
  WARNING_DAYS,
  REPLENISH_THRESHOLD_DAYS
};
