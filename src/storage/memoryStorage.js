const { normalizeCapacity, normalizeQuantity, parseInteger, parsePositiveInteger } = require('../utils/validator');

class MemoryStorage {
  constructor() {
    this.candles = [];
    this.burningRecords = [];
    this.inventory = [];
    this.consumptionModels = new Map();
    this.tips = [];
    this._initDefaultData();
  }

  _sanitizeInventoryItem(item) {
    if (!item) return item;
    const qty = parsePositiveInteger(item.quantity);
    item.quantity = qty !== null ? qty : 0;
    const cap = normalizeCapacity(item.capacity);
    if (cap !== null) {
      item.capacity = cap;
    }
    return item;
  }

  _initDefaultData() {
    this.candles = [
      { id: 1, brand: 'Yankee Candle', waxType: 'soy', wickSize: 'medium', capacity: 411, unit: 'g', price: 188 },
      { id: 2, brand: 'Diptyque', waxType: 'soy', wickSize: 'large', capacity: 190, unit: 'g', price: 320 },
      { id: 3, brand: 'Voluspa', waxType: 'coconut', wickSize: 'medium', capacity: 156, unit: 'g', price: 168 },
      { id: 4, brand: 'P.F. Candle Co.', waxType: 'soy', wickSize: 'small', capacity: 204, unit: 'g', price: 198 },
      { id: 5, brand: 'Jo Malone', waxType: 'beeswax', wickSize: 'medium', capacity: 200, unit: 'g', price: 480 }
    ];

    this.tips = [
      { id: 1, type: 'burning_too_fast', title: '燃烧过快优化技巧', content: '建议修剪烛芯至5mm长度，避免长时间连续燃烧不超过4小时，放置在无风区域使用。' },
      { id: 2, type: 'tunneling', title: '避免挂壁技巧', content: '首次燃烧需让蜡面完全融化形成记忆池，约1-2小时，防止蜡池形成后再熄灭。' },
      { id: 3, type: 'smoke', title: '减少黑烟技巧', content: '熄灭时用烛钩将烛芯浸入蜡油后再扶正，或使用灭烛罩，避免直接吹灭产生黑烟。' },
      { id: 4, type: 'efficiency', title: '延长使用寿命', content: '每次使用前修剪烛芯，保持燃烧环境温度稳定，避免温差过大。' }
    ];
  }

  addBurningRecord(record) {
    record.id = this.burningRecords.length + 1;
    record.timestamp = Date.now();
    this.burningRecords.push(record);
    return record;
  }

  getBurningRecords(filters = {}) {
    let records = [...this.burningRecords];
    if (filters.brand) {
      records = records.filter(r => r.brand === filters.brand);
    }
    if (filters.candleId) {
      records = records.filter(r => r.candleId === filters.candleId);
    }
    return records;
  }

  addInventoryItem(item) {
    const normalizedQuantity = normalizeQuantity(item.quantity);
    if (normalizedQuantity === null) {
      throw new Error('quantity 必须是有效的非负整数');
    }

    const normalizedCapacity = normalizeCapacity(item.capacity);
    if (normalizedCapacity === null) {
      throw new Error('capacity 必须是有效的正整数');
    }

    const existing = this.inventory.find(i =>
      i.brand === item.brand && i.capacity === normalizedCapacity
    );

    if (existing) {
      this._sanitizeInventoryItem(existing);
      existing.quantity += normalizedQuantity;
      existing.lastUpdated = Date.now();
      return existing;
    }

    const newItem = {
      ...item,
      id: this.inventory.length + 1,
      capacity: normalizedCapacity,
      quantity: normalizedQuantity,
      lastUpdated: Date.now()
    };
    this.inventory.push(newItem);
    return newItem;
  }

  updateInventory(id, updates) {
    const item = this.inventory.find(i => i.id === id);
    if (item) {
      this._sanitizeInventoryItem(item);
      const safeUpdates = { ...updates };
      if (safeUpdates.quantity !== undefined) {
        const qty = normalizeQuantity(safeUpdates.quantity);
        if (qty === null) {
          throw new Error('quantity 必须是有效的非负整数');
        }
        safeUpdates.quantity = qty;
      }
      if (safeUpdates.capacity !== undefined) {
        const cap = normalizeCapacity(safeUpdates.capacity);
        if (cap === null) {
          throw new Error('capacity 必须是有效的正整数');
        }
        safeUpdates.capacity = cap;
      }
      Object.assign(item, safeUpdates, { lastUpdated: Date.now() });
    }
    return item;
  }

  getInventory(filters = {}) {
    let items = [...this.inventory];
    if (filters.brand) {
      items = items.filter(i => i.brand === filters.brand);
    }
    return items;
  }

  getInventoryByBrandAndCapacity(brand, capacity) {
    const normalizedCapacity = normalizeCapacity(capacity);
    if (normalizedCapacity === null) return null;
    return this.inventory.find(i => i.brand === brand && i.capacity === normalizedCapacity);
  }

  saveConsumptionModel(candleId, model) {
    this.consumptionModels.set(candleId, model);
    return model;
  }

  getConsumptionModel(candleId) {
    return this.consumptionModels.get(candleId) || null;
  }

  getAllConsumptionModels() {
    return Array.from(this.consumptionModels.values());
  }

  getCandleByBrandAndCapacity(brand, capacity) {
    const normalizedCapacity = normalizeCapacity(capacity);
    if (normalizedCapacity === null) return null;
    return this.candles.find(c => c.brand === brand && c.capacity === normalizedCapacity);
  }

  getCandleById(id) {
    return this.candles.find(c => c.id === id);
  }

  getAllCandles() {
    return [...this.candles];
  }

  getTipsByType(type) {
    return this.tips.filter(t => t.type === type);
  }

  getAllTips() {
    return [...this.tips];
  }
}

const storage = new MemoryStorage();
module.exports = storage;
