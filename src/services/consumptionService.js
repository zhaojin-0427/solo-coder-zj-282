const { storage, DEFAULT_USER_ID } = require('../storage/memoryStorage');

const WAX_BURN_RATE = {
  soy: 6.5,
  paraffin: 8.0,
  beeswax: 5.0,
  coconut: 7.0,
  palm: 7.5
};

const WICK_FACTOR = {
  small: 0.8,
  medium: 1.0,
  large: 1.3,
  extra_large: 1.6
};

const TEMPERATURE_FACTOR = {
  cold: 0.85,
  normal: 1.0,
  hot: 1.15
};

const HUMIDITY_FACTOR = {
  dry: 1.1,
  normal: 1.0,
  humid: 0.9
};

function classifyTemperature(temp) {
  if (temp < 18) return 'cold';
  if (temp > 28) return 'hot';
  return 'normal';
}

function classifyHumidity(humidity) {
  if (humidity < 40) return 'dry';
  if (humidity > 70) return 'humid';
  return 'normal';
}

function calculateTheoreticalBurnRate(candle, temperature = 22, humidity = 50) {
  const waxRate = WAX_BURN_RATE[candle.waxType] || WAX_BURN_RATE.soy;
  const wickFactor = WICK_FACTOR[candle.wickSize] || WICK_FACTOR.medium;
  const tempFactor = TEMPERATURE_FACTOR[classifyTemperature(temperature)];
  const humidityFactor = HUMIDITY_FACTOR[classifyHumidity(humidity)];
  return waxRate * wickFactor * tempFactor * humidityFactor;
}

function calculateActualBurnRate(records) {
  if (!records || records.length === 0) return null;
  const totalBurned = records.reduce((sum, r) => sum + (r.actualBurned || 0), 0);
  const totalHours = records.reduce((sum, r) => sum + r.burnHours, 0);
  if (totalHours === 0) return null;
  return totalBurned / totalHours;
}

function buildConsumptionModel(candleId, records, userId) {
  const uid = userId || DEFAULT_USER_ID;
  const candle = storage.getCandleById(candleId);
  if (!candle) return null;

  if (!records || records.length === 0) return null;

  const actualRate = calculateActualBurnRate(records);
  const defaultRecords = records.filter(r => r.temperature !== undefined && r.humidity !== undefined);
  const avgTemp = defaultRecords.length > 0
    ? defaultRecords.reduce((sum, r) => sum + r.temperature, 0) / defaultRecords.length
    : 22;
  const avgHumidity = defaultRecords.length > 0
    ? defaultRecords.reduce((sum, r) => sum + r.humidity, 0) / defaultRecords.length
    : 50;

  const theoreticalRate = calculateTheoreticalBurnRate(candle, avgTemp, avgHumidity);

  const usagePattern = analyzeUsagePattern(records);

  const model = {
    candleId,
    brand: candle.brand,
    capacity: candle.capacity,
    waxType: candle.waxType,
    wickSize: candle.wickSize,
    theoreticalBurnRate: Number(theoreticalRate.toFixed(2)),
    actualBurnRate: actualRate ? Number(actualRate.toFixed(2)) : null,
    efficiency: actualRate ? Number((theoreticalRate / actualRate * 100).toFixed(1)) : null,
    averageTemperature: Number(avgTemp.toFixed(1)),
    averageHumidity: Number(avgHumidity.toFixed(1)),
    usagePattern,
    estimatedTotalHours: actualRate ? Number((candle.capacity / actualRate).toFixed(1)) : null,
    dataPoints: records.length,
    lastUpdated: Date.now()
  };

  storage.saveConsumptionModel(candleId, model, uid);
  return model;
}

function analyzeUsagePattern(records) {
  if (!records || records.length === 0) return null;

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

  return {
    averageSessionHours: Number(avgSessionHours.toFixed(1)),
    totalSessions,
    frequency,
    sessionLength
  };
}

function getBrandEfficiency(userId) {
  const uid = userId || DEFAULT_USER_ID;
  const candles = storage.getAllCandles();
  const records = storage.getBurningRecords({ userId: uid });
  const brandData = {};

  candles.forEach(candle => {
    if (!brandData[candle.brand]) {
      brandData[candle.brand] = {
        brand: candle.brand,
        records: [],
        price: candle.price,
        capacity: candle.capacity
      };
    }
    const candleRecords = records.filter(r => r.candleId === candle.id);
    brandData[candle.brand].records.push(...candleRecords);
  });

  return Object.values(brandData).map(data => {
    const actualRate = calculateActualBurnRate(data.records);
    const theoreticalRate = data.records.length > 0
      ? calculateTheoreticalBurnRate({ waxType: 'soy', wickSize: 'medium' })
      : null;

    const efficiency = actualRate && theoreticalRate
      ? Number((theoreticalRate / actualRate * 100).toFixed(1))
      : null;

    const hoursPerGram = actualRate ? Number((1 / actualRate).toFixed(3)) : null;
    const valueScore = hoursPerGram && data.price && data.capacity
      ? Number((data.capacity * hoursPerGram / data.price * 100).toFixed(1))
      : null;

    return {
      brand: data.brand,
      averageBurnRate: actualRate ? Number(actualRate.toFixed(2)) : null,
      efficiencyPercent: efficiency,
      hoursPerGram,
      valueScore,
      price: data.price,
      capacity: data.capacity,
      estimatedTotalHours: actualRate ? Number((data.capacity / actualRate).toFixed(1)) : null,
      dataPoints: data.records.length
    };
  });
}

function detectAnomaly(record) {
  const anomalies = [];
  const candle = storage.getCandleById(record.candleId);

  if (!candle) return anomalies;

  const theoreticalRate = calculateTheoreticalBurnRate(candle, record.temperature, record.humidity);
  const actualRate = record.actualBurned / record.burnHours;

  if (actualRate > theoreticalRate * 1.3) {
    anomalies.push({
      type: 'burning_too_fast',
      severity: 'warning',
      expectedRate: Number(theoreticalRate.toFixed(2)),
      actualRate: Number(actualRate.toFixed(2)),
      deviation: Number(((actualRate - theoreticalRate) / theoreticalRate * 100).toFixed(1))
    });
  }

  if (actualRate < theoreticalRate * 0.7) {
    anomalies.push({
      type: 'tunneling',
      severity: 'warning',
      expectedRate: Number(theoreticalRate.toFixed(2)),
      actualRate: Number(actualRate.toFixed(2)),
      deviation: Number(((theoreticalRate - actualRate) / theoreticalRate * 100).toFixed(1))
    });
  }

  return anomalies;
}

module.exports = {
  calculateTheoreticalBurnRate,
  calculateActualBurnRate,
  buildConsumptionModel,
  analyzeUsagePattern,
  getBrandEfficiency,
  detectAnomaly,
  classifyTemperature,
  classifyHumidity,
  WAX_BURN_RATE,
  WICK_FACTOR
};
