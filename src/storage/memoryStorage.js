const { normalizeCapacity, normalizeQuantity, parseInteger, parsePositiveInteger } = require('../utils/validator');

const DEFAULT_USER_ID = 'default';

function isValidUserId(userId) {
  if (userId === undefined || userId === null) return false;
  if (typeof userId !== 'string') return false;
  const trimmed = userId.trim();
  return trimmed.length > 0 && trimmed.length <= 64;
}

function normalizeUserId(userId) {
  if (!isValidUserId(userId)) {
    throw new Error('userId 非法，必须是1-64位的非空字符串');
  }
  return userId.trim();
}

class MemoryStorage {
  constructor() {
    this.candles = [];
    this.burningRecords = [];
    this.inventory = [];
    this.consumptionModels = new Map();
    this.tips = [];
    this.userProfiles = new Map();
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

  addBurningRecord(record, userId) {
    const uid = userId ? normalizeUserId(userId) : DEFAULT_USER_ID;
    record.id = this.burningRecords.length + 1;
    record.timestamp = Date.now();
    record.userId = uid;
    this.burningRecords.push(record);
    return record;
  }

  getBurningRecords(filters = {}) {
    const uid = filters.userId ? normalizeUserId(filters.userId) : DEFAULT_USER_ID;
    let records = this.burningRecords.filter(r => r.userId === uid);
    if (filters.brand) {
      records = records.filter(r => r.brand === filters.brand);
    }
    if (filters.candleId) {
      records = records.filter(r => r.candleId === filters.candleId);
    }
    if (filters.scene) {
      records = records.filter(r => r.scene === filters.scene);
    }
    return records;
  }

  addInventoryItem(item, userId) {
    const uid = userId ? normalizeUserId(userId) : DEFAULT_USER_ID;

    const normalizedQuantity = normalizeQuantity(item.quantity);
    if (normalizedQuantity === null) {
      throw new Error('quantity 必须是有效的非负整数');
    }

    const normalizedCapacity = normalizeCapacity(item.capacity);
    if (normalizedCapacity === null) {
      throw new Error('capacity 必须是有效的正整数');
    }

    const existing = this.inventory.find(i =>
      i.userId === uid &&
      i.brand === item.brand &&
      i.capacity === normalizedCapacity &&
      (item.scene ? i.scene === item.scene : !i.scene)
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
      userId: uid,
      capacity: normalizedCapacity,
      quantity: normalizedQuantity,
      lastUpdated: Date.now()
    };
    this.inventory.push(newItem);
    return newItem;
  }

  updateInventory(id, updates, userId) {
    const uid = userId ? normalizeUserId(userId) : DEFAULT_USER_ID;
    const item = this.inventory.find(i => i.id === id && i.userId === uid);
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
    const uid = filters.userId ? normalizeUserId(filters.userId) : DEFAULT_USER_ID;
    let items = this.inventory.filter(i => i.userId === uid);
    if (filters.brand) {
      items = items.filter(i => i.brand === filters.brand);
    }
    if (filters.scene) {
      items = items.filter(i => i.scene === filters.scene);
    }
    return items;
  }

  getInventoryByBrandAndCapacity(brand, capacity, userId) {
    const uid = userId ? normalizeUserId(userId) : DEFAULT_USER_ID;
    const normalizedCapacity = normalizeCapacity(capacity);
    if (normalizedCapacity === null) return null;
    return this.inventory.find(i =>
      i.userId === uid &&
      i.brand === brand &&
      i.capacity === normalizedCapacity);
  }

  saveConsumptionModel(candleId, model, userId) {
    const uid = userId ? normalizeUserId(userId) : DEFAULT_USER_ID;
    const key = `${uid}:${candleId}`;
    this.consumptionModels.set(key, model);
    return model;
  }

  getConsumptionModel(candleId, userId) {
    const uid = userId ? normalizeUserId(userId) : DEFAULT_USER_ID;
    const key = `${uid}:${candleId}`;
    return this.consumptionModels.get(key) || null;
  }

  getAllConsumptionModels(userId) {
    const uid = userId ? normalizeUserId(userId) : DEFAULT_USER_ID;
    return Array.from(this.consumptionModels.entries())
      .filter(([key]) => key.startsWith(`${uid}:`))
      .map(([, model]) => model);
  }

  saveUserProfile(userId, profile) {
    const uid = normalizeUserId(userId);
    this.userProfiles.set(uid, {
      ...profile,
      userId: uid,
      lastUpdated: Date.now()
    });
    return this.userProfiles.get(uid);
  }

  getUserProfile(userId) {
    const uid = normalizeUserId(userId);
    return this.userProfiles.get(uid) || null;
  }

  getAllUserProfiles() {
    return Array.from(this.userProfiles.values());
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

module.exports = {
  storage,
  isValidUserId,
  normalizeUserId,
  DEFAULT_USER_ID
};
