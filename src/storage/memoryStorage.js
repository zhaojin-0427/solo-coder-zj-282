const { normalizeCapacity, normalizeQuantity, parseInteger, parsePositiveInteger, parseNumber } = require('../utils/validator');

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
    this.scentTags = [];
    this.fragranceCategories = [];
    this.usageScenarios = [];
    this.moodGoals = [];
    this.seasonPreferences = [];
    this.userScentPreferences = new Map();
    this.userRatings = [];
    this.conflictScentRules = [];
    this.sceneFragranceMapping = [];
    this.moodFragranceMapping = [];
    this.seasonFragranceMapping = [];
    this.safetyRules = [];
    this.safetyRiskLevels = [];
    this.safetyFactors = [];
    this.roomEnvironments = new Map();
    this.safetyInspectionRecords = [];
    this.burningEvents = [];
    this.userSafetyProfiles = new Map();
    this.safetyAlerts = [];
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
      { id: 1, brand: 'Yankee Candle', name: '香草薰衣草', waxType: 'soy', wickSize: 'medium', capacity: 411, unit: 'g', price: 188, fragranceCategory: 'floral', scentTags: ['香草', '薰衣草'], intensity: 'medium' },
      { id: 2, brand: 'Diptyque', name: '杜桑', waxType: 'soy', wickSize: 'large', capacity: 190, unit: 'g', price: 320, fragranceCategory: 'floral', scentTags: ['晚香玉', '橙花', '茉莉'], intensity: 'strong' },
      { id: 3, brand: 'Voluspa', name: '波罗的海琥珀', waxType: 'coconut', wickSize: 'medium', capacity: 156, unit: 'g', price: 168, fragranceCategory: 'woody', scentTags: ['琥珀', '麝香', '檀香'], intensity: 'medium' },
      { id: 4, brand: 'P.F. Candle Co.', name: '柚木烟草', waxType: 'soy', wickSize: 'small', capacity: 204, unit: 'g', price: 198, fragranceCategory: 'woody', scentTags: ['柚木', '烟草', '皮革'], intensity: 'medium' },
      { id: 5, brand: 'Jo Malone', name: '英国梨与小苍兰', waxType: 'beeswax', wickSize: 'medium', capacity: 200, unit: 'g', price: 480, fragranceCategory: 'fresh', scentTags: ['梨', '小苍兰', '白麝香'], intensity: 'light' },
      { id: 6, brand: 'Yankee Candle', name: '柠檬薄荷', waxType: 'soy', wickSize: 'medium', capacity: 411, unit: 'g', price: 188, fragranceCategory: 'fresh', scentTags: ['柠檬', '薄荷', '柑橘'], intensity: 'medium' },
      { id: 7, brand: 'Diptyque', name: '无花果', waxType: 'soy', wickSize: 'medium', capacity: 190, unit: 'g', price: 320, fragranceCategory: 'woody', scentTags: ['无花果', '雪松', '白松香'], intensity: 'medium' },
      { id: 8, brand: 'Jo Malone', name: '鼠尾草与海盐', waxType: 'beeswax', wickSize: 'medium', capacity: 200, unit: 'g', price: 480, fragranceCategory: 'fresh', scentTags: ['鼠尾草', '海盐', '琥珀'], intensity: 'light' }
    ];

    this.tips = [
      { id: 1, type: 'burning_too_fast', title: '燃烧过快优化技巧', content: '建议修剪烛芯至5mm长度，避免长时间连续燃烧不超过4小时，放置在无风区域使用。' },
      { id: 2, type: 'tunneling', title: '避免挂壁技巧', content: '首次燃烧需让蜡面完全融化形成记忆池，约1-2小时，防止蜡池形成后再熄灭。' },
      { id: 3, type: 'smoke', title: '减少黑烟技巧', content: '熄灭时用烛钩将烛芯浸入蜡油后再扶正，或使用灭烛罩，避免直接吹灭产生黑烟。' },
      { id: 4, type: 'efficiency', title: '延长使用寿命', content: '每次使用前修剪烛芯，保持燃烧环境温度稳定，避免温差过大。' }
    ];

    this.scentTags = [
      { id: 1, name: '香草', category: 'gourmand', description: '温暖甜美的香草香调' },
      { id: 2, name: '薰衣草', category: 'herbal', description: '舒缓放松的薰衣草香调' },
      { id: 3, name: '晚香玉', category: 'floral', description: '浓郁的晚香玉花香' },
      { id: 4, name: '橙花', category: 'floral', description: '清新的橙花香调' },
      { id: 5, name: '茉莉', category: 'floral', description: '雅致的茉莉花香' },
      { id: 6, name: '琥珀', category: 'woody', description: '温暖的琥珀香调' },
      { id: 7, name: '麝香', category: 'woody', description: '性感的麝香底调' },
      { id: 8, name: '檀香', category: 'woody', description: '沉稳的檀香木调' },
      { id: 9, name: '柚木', category: 'woody', description: '木质调的柚木香' },
      { id: 10, name: '烟草', category: 'woody', description: '成熟的烟草香调' },
      { id: 11, name: '皮革', category: 'woody', description: '复古的皮革香气' },
      { id: 12, name: '梨', category: 'fruity', description: '清甜的梨香' },
      { id: 13, name: '小苍兰', category: 'floral', description: '清新的小苍兰花香' },
      { id: 14, name: '白麝香', category: 'woody', description: '干净的白麝香' },
      { id: 15, name: '柠檬', category: 'citrus', description: '明亮的柠檬香' },
      { id: 16, name: '薄荷', category: 'herbal', description: '清凉的薄荷香' },
      { id: 17, name: '柑橘', category: 'citrus', description: '清新的柑橘香调' },
      { id: 18, name: '无花果', category: 'fruity', description: '甜美的无花果香' },
      { id: 19, name: '雪松', category: 'woody', description: '清冽的雪松木香' },
      { id: 20, name: '白松香', category: 'herbal', description: '草本的白松香' },
      { id: 21, name: '鼠尾草', category: 'herbal', description: '草本的鼠尾草香' },
      { id: 22, name: '海盐', category: 'aqua', description: '海洋的咸湿气息' },
      { id: 23, name: '玫瑰', category: 'floral', description: '经典的玫瑰花香' },
      { id: 24, name: '雪松', category: 'woody', description: '温暖的雪松木香' }
    ];

    this.fragranceCategories = [
      { id: 1, code: 'floral', name: '花香调', description: '以鲜花香气为主的香调，如玫瑰、茉莉、薰衣草' },
      { id: 2, code: 'woody', name: '木质调', description: '以木材香气为主的香调，如檀香、雪松、琥珀' },
      { id: 3, code: 'fresh', name: '清新调', description: '清爽干净的香调，如柑橘、草本、海洋' },
      { id: 4, code: 'gourmand', name: '美食调', description: '甜美的食物香调，如香草、焦糖、巧克力' },
      { id: 5, code: 'oriental', name: '东方调', description: '浓郁神秘的东方香调，如麝香、乳香' },
      { id: 6, code: 'citrus', name: '柑橘调', description: '明亮活泼的柑橘果香' },
      { id: 7, code: 'herbal', name: '草本调', description: '清新自然的草本植物香调' },
      { id: 8, code: 'fruity', name: '果香调', description: '甜美多汁的水果香调' }
    ];

    this.usageScenarios = [
      { id: 1, code: 'living_room', name: '客厅', description: '家庭社交、休闲娱乐空间' },
      { id: 2, code: 'bedroom', name: '卧室', description: '睡眠、休息、放松空间' },
      { id: 3, code: 'study', name: '书房', description: '工作、学习、阅读空间' },
      { id: 4, code: 'bathroom', name: '浴室', description: '沐浴、放松、除味空间' },
      { id: 5, code: 'kitchen', name: '厨房', description: '烹饪、除味空间' },
      { id: 6, code: 'office', name: '办公室', description: '办公、会议空间' },
      { id: 7, code: 'dining_room', name: '餐厅', description: '用餐、聚会空间' },
      { id: 8, code: 'entrance', name: '玄关', description: '入户空间，营造第一印象' }
    ];

    this.moodGoals = [
      { id: 1, code: 'sleep', name: '助眠', description: '帮助放松入睡，舒缓焦虑' },
      { id: 2, code: 'relax', name: '放松', description: '舒缓压力，放松身心' },
      { id: 3, code: 'focus', name: '专注', description: '提升专注力，提高工作效率' },
      { id: 4, code: 'deodorize', name: '除味', description: '去除异味，清新空气' },
      { id: 5, code: 'romance', name: '约会', description: '营造浪漫温馨氛围' },
      { id: 6, code: 'festive', name: '节日', description: '营造节日喜庆氛围' },
      { id: 7, code: 'energize', name: '提神', description: '提振精神，焕发活力' },
      { id: 8, code: 'meditate', name: '冥想', description: '辅助冥想，平静内心' }
    ];

    this.seasonPreferences = [
      { id: 1, code: 'spring', name: '春季', description: '万物复苏，适合清新花香调' },
      { id: 2, code: 'summer', name: '夏季', description: '炎热季节，适合清凉柑橘、海洋调' },
      { id: 3, code: 'autumn', name: '秋季', description: '凉爽季节，适合温暖木质、美食调' },
      { id: 4, code: 'winter', name: '冬季', description: '寒冷季节，适合浓郁东方、温暖香调' }
    ];

    this.conflictScentRules = [
      { id: 1, scent1: '薰衣草', scent2: '薄荷', reason: '薰衣草的舒缓与薄荷的提神相互抵消，建议分开使用' },
      { id: 2, scent1: '香草', scent2: '柠檬', reason: '甜腻的香草与清爽的柠檬可能产生不协调感' },
      { id: 3, scent1: '麝香', scent2: '茉莉', reason: '两者都是浓郁香调，同时使用可能过于厚重' },
      { id: 4, scent1: '檀香', scent2: '柑橘', reason: '沉稳的檀香与明亮的柑橘调性冲突' },
      { id: 5, scent1: '烟草', scent2: '小苍兰', reason: '成熟的烟草与清新的小苍兰风格不匹配' }
    ];

    this.sceneFragranceMapping = [
      { scene: 'living_room', category: 'woody', weight: 0.6, reason: '木质调营造温馨舒适的居家氛围' },
      { scene: 'living_room', category: 'floral', weight: 0.4, reason: '花香调增添生活气息' },
      { scene: 'bedroom', category: 'floral', weight: 0.5, reason: '薰衣草等花香有助于放松助眠' },
      { scene: 'bedroom', category: 'woody', weight: 0.3, reason: '檀香等木质调营造安全感' },
      { scene: 'bedroom', category: 'herbal', weight: 0.2, reason: '草本香调舒缓神经' },
      { scene: 'study', category: 'fresh', weight: 0.5, reason: '清新调保持头脑清醒' },
      { scene: 'study', category: 'woody', weight: 0.3, reason: '木质调帮助集中注意力' },
      { scene: 'study', category: 'citrus', weight: 0.2, reason: '柑橘调提神醒脑' },
      { scene: 'bathroom', category: 'fresh', weight: 0.5, reason: '清新调去除异味' },
      { scene: 'bathroom', category: 'citrus', weight: 0.3, reason: '柑橘调清新空气' },
      { scene: 'bathroom', category: 'herbal', weight: 0.2, reason: '草本调营造洁净感' },
      { scene: 'kitchen', category: 'citrus', weight: 0.6, reason: '柑橘调有效中和油烟味' },
      { scene: 'kitchen', category: 'fresh', weight: 0.4, reason: '清新调保持空气清新' },
      { scene: 'office', category: 'fresh', weight: 0.4, reason: '清新调保持工作效率' },
      { scene: 'office', category: 'woody', weight: 0.3, reason: '木质调营造专业氛围' },
      { scene: 'office', category: 'citrus', weight: 0.3, reason: '柑橘调提神醒脑' },
      { scene: 'dining_room', category: 'fruity', weight: 0.4, reason: '果香调增进食欲' },
      { scene: 'dining_room', category: 'floral', weight: 0.3, reason: '花香调增添优雅氛围' },
      { scene: 'dining_room', category: 'woody', weight: 0.3, reason: '木质调营造温馨用餐环境' },
      { scene: 'entrance', category: 'fresh', weight: 0.5, reason: '清新调给人良好第一印象' },
      { scene: 'entrance', category: 'citrus', weight: 0.3, reason: '柑橘调明亮活泼' },
      { scene: 'entrance', category: 'floral', weight: 0.2, reason: '花香调温馨迎宾' }
    ];

    this.moodFragranceMapping = [
      { mood: 'sleep', category: 'floral', weight: 0.5, reason: '薰衣草等花香舒缓助眠' },
      { mood: 'sleep', category: 'woody', weight: 0.3, reason: '檀香等木质调安抚情绪' },
      { mood: 'sleep', category: 'herbal', weight: 0.2, reason: '草本香调放松身心' },
      { mood: 'relax', category: 'floral', weight: 0.4, reason: '花香调舒缓压力' },
      { mood: 'relax', category: 'woody', weight: 0.4, reason: '木质调带来安全感' },
      { mood: 'relax', category: 'herbal', weight: 0.2, reason: '草本香调放松肌肉' },
      { mood: 'focus', category: 'fresh', weight: 0.4, reason: '清新调保持头脑清醒' },
      { mood: 'focus', category: 'citrus', weight: 0.3, reason: '柑橘调提神醒脑' },
      { mood: 'focus', category: 'woody', weight: 0.3, reason: '木质调帮助集中注意力' },
      { mood: 'deodorize', category: 'citrus', weight: 0.5, reason: '柑橘调中和异味' },
      { mood: 'deodorize', category: 'fresh', weight: 0.5, reason: '清新调净化空气' },
      { mood: 'romance', category: 'floral', weight: 0.5, reason: '玫瑰等花香营造浪漫氛围' },
      { mood: 'romance', category: 'oriental', weight: 0.3, reason: '东方调增添神秘感' },
      { mood: 'romance', category: 'woody', weight: 0.2, reason: '麝香等木质调增添性感' },
      { mood: 'festive', category: 'fruity', weight: 0.4, reason: '果香调营造喜庆氛围' },
      { mood: 'festive', category: 'gourmand', weight: 0.3, reason: '美食调增添甜蜜感' },
      { mood: 'festive', category: 'floral', weight: 0.3, reason: '花香调增添热闹气氛' },
      { mood: 'energize', category: 'citrus', weight: 0.5, reason: '柑橘调提振精神' },
      { mood: 'energize', category: 'fresh', weight: 0.3, reason: '清新调焕发活力' },
      { mood: 'energize', category: 'herbal', weight: 0.2, reason: '薄荷等草本调清凉提神' },
      { mood: 'meditate', category: 'woody', weight: 0.5, reason: '檀香等木质调平静内心' },
      { mood: 'meditate', category: 'herbal', weight: 0.3, reason: '草本香调辅助冥想' },
      { mood: 'meditate', category: 'floral', weight: 0.2, reason: '花香调柔和心灵' }
    ];

    this.seasonFragranceMapping = [
      { season: 'spring', category: 'floral', weight: 0.5, reason: '春季万物复苏，花香调应景' },
      { season: 'spring', category: 'fresh', weight: 0.3, reason: '清新调感受春意' },
      { season: 'spring', category: 'fruity', weight: 0.2, reason: '果香调增添甜美' },
      { season: 'summer', category: 'citrus', weight: 0.4, reason: '柑橘调清凉解暑' },
      { season: 'summer', category: 'fresh', weight: 0.3, reason: '清新调凉爽舒适' },
      { season: 'summer', category: 'herbal', weight: 0.3, reason: '薄荷等草本降温' },
      { season: 'autumn', category: 'woody', weight: 0.4, reason: '木质调温暖舒适' },
      { season: 'autumn', category: 'gourmand', weight: 0.3, reason: '美食调增添暖意' },
      { season: 'autumn', category: 'fruity', weight: 0.3, reason: '果香调秋收气息' },
      { season: 'winter', category: 'woody', weight: 0.4, reason: '木质调驱寒温暖' },
      { season: 'winter', category: 'oriental', weight: 0.3, reason: '东方调浓郁暖心' },
      { season: 'winter', category: 'gourmand', weight: 0.3, reason: '美食调甜蜜温暖' }
    ];

    this.safetyRiskLevels = [
      { id: 1, level: 'safe', name: '安全', minScore: 0, maxScore: 20, color: 'green', description: '燃烧环境安全，可正常使用' },
      { id: 2, level: 'caution', name: '注意', minScore: 21, maxScore: 40, color: 'yellow', description: '存在轻微风险因素，建议关注' },
      { id: 3, level: 'warning', name: '警告', minScore: 41, maxScore: 60, color: 'orange', description: '存在明显风险，需采取措施' },
      { id: 4, level: 'danger', name: '危险', minScore: 61, maxScore: 80, color: 'red', description: '风险较高，建议立即熄灭' },
      { id: 5, level: 'critical', name: '极度危险', minScore: 81, maxScore: 100, color: 'darkred', description: '极度危险，必须立即熄灭并整改' }
    ];

    this.safetyRules = [
      { id: 1, code: 'max_continuous_burn', name: '最大连续燃烧时长', value: 4, unit: 'hours', riskScore: 15, description: '单次连续燃烧不超过4小时' },
      { id: 2, code: 'min_ventilation_distance', name: '最小通风距离', value: 30, unit: 'cm', riskScore: 10, description: '蜡烛与墙壁/家具距离至少30cm' },
      { id: 3, code: 'min_combustible_distance', name: '最小可燃物距离', value: 50, unit: 'cm', riskScore: 25, description: '蜡烛与可燃物距离至少50cm' },
      { id: 4, code: 'max_humidity_low', name: '最低湿度阈值', value: 30, unit: '%', riskScore: 10, description: '湿度过低（<30%）增加火灾风险' },
      { id: 5, code: 'max_temperature_high', name: '最高温度阈值', value: 30, unit: '°C', riskScore: 10, description: '温度过高（>30°C）增加火灾风险' },
      { id: 6, code: 'child_presence', name: '儿童在场', value: true, unit: 'boolean', riskScore: 30, description: '儿童在场时需特别注意安全' },
      { id: 7, code: 'pet_presence', name: '宠物在场', value: true, unit: 'boolean', riskScore: 20, description: '宠物在场时需特别注意安全' },
      { id: 8, code: 'poor_ventilation', name: '通风不良', value: true, unit: 'boolean', riskScore: 20, description: '密闭空间燃烧增加一氧化碳风险' },
      { id: 9, code: 'night_burning', name: '夜间燃烧', value: true, unit: 'boolean', riskScore: 25, description: '睡眠时段燃烧无人看管风险高' },
      { id: 10, code: 'wick_too_long', name: '烛芯过长', value: 10, unit: 'mm', riskScore: 15, description: '烛芯超过10mm需修剪' }
    ];

    this.safetyFactors = [
      { id: 1, code: 'wax_type', name: '蜡基类型', type: 'candle_property', options: [
        { value: 'soy', riskMultiplier: 1.0, description: '大豆蜡，燃烧较稳定' },
        { value: 'paraffin', riskMultiplier: 1.2, description: '石蜡，燃烧温度较高' },
        { value: 'beeswax', riskMultiplier: 0.9, description: '蜂蜡，燃烧最稳定' },
        { value: 'coconut', riskMultiplier: 1.1, description: '椰子蜡，燃烧温度中等' },
        { value: 'palm', riskMultiplier: 1.15, description: '棕榈蜡，燃烧温度较高' }
      ]},
      { id: 2, code: 'wick_size', name: '烛芯规格', type: 'candle_property', options: [
        { value: 'small', riskMultiplier: 0.8, description: '小烛芯，火焰小风险低' },
        { value: 'medium', riskMultiplier: 1.0, description: '中烛芯，标准风险' },
        { value: 'large', riskMultiplier: 1.3, description: '大烛芯，火焰大风险高' },
        { value: 'extra_large', riskMultiplier: 1.5, description: '超大烛芯，高风险' }
      ]},
      { id: 3, code: 'room_type', name: '房间类型', type: 'environment', options: [
        { value: 'living_room', riskMultiplier: 1.0, description: '客厅，通常有人看管' },
        { value: 'bedroom', riskMultiplier: 1.4, description: '卧室，睡眠时风险高' },
        { value: 'study', riskMultiplier: 0.9, description: '书房，通常有人看管' },
        { value: 'bathroom', riskMultiplier: 1.2, description: '浴室，湿度高但空间小' },
        { value: 'kitchen', riskMultiplier: 1.5, description: '厨房，可燃物多' },
        { value: 'dining_room', riskMultiplier: 1.1, description: '餐厅，用餐时段使用' },
        { value: 'entrance', riskMultiplier: 1.3, description: '玄关，无人看管时间长' }
      ]},
      { id: 4, code: 'time_period', name: '使用时段', type: 'temporal', options: [
        { value: 'morning', riskMultiplier: 0.8, description: '早晨(6-12)，清醒状态' },
        { value: 'afternoon', riskMultiplier: 0.9, description: '下午(12-18)，清醒状态' },
        { value: 'evening', riskMultiplier: 1.1, description: '傍晚(18-22)，可能疲倦' },
        { value: 'night', riskMultiplier: 1.8, description: '深夜(22-6)，睡眠风险高' }
      ]}
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
    let records = this.burningRecords.filter(r => r && r.userId === uid);
    if (filters.brand) {
      records = records.filter(r => r && r.brand === filters.brand);
    }
    if (filters.candleId) {
      records = records.filter(r => r && r.candleId === filters.candleId);
    }
    if (filters.scene) {
      records = records.filter(r => r && r.scene === filters.scene);
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
    let items = this.inventory.filter(i => i && i.userId === uid);
    if (filters.brand) {
      items = items.filter(i => i && i.brand === filters.brand);
    }
    if (filters.scene) {
      items = items.filter(i => i && i.scene === filters.scene);
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

  addScentTag(tag) {
    const newTag = {
      ...tag,
      id: this.scentTags.length + 1,
      createdAt: Date.now()
    };
    this.scentTags.push(newTag);
    return newTag;
  }

  getScentTags(filters = {}) {
    let tags = [...this.scentTags];
    if (filters.name) {
      tags = tags.filter(t => t.name.includes(filters.name));
    }
    if (filters.category) {
      tags = tags.filter(t => t.category === filters.category);
    }
    return tags;
  }

  getScentTagById(id) {
    return this.scentTags.find(t => t.id === id) || null;
  }

  updateScentTag(id, updates) {
    const tag = this.scentTags.find(t => t.id === id);
    if (tag) {
      Object.assign(tag, updates, { updatedAt: Date.now() });
    }
    return tag;
  }

  deleteScentTag(id) {
    const index = this.scentTags.findIndex(t => t.id === id);
    if (index !== -1) {
      return this.scentTags.splice(index, 1)[0];
    }
    return null;
  }

  addFragranceCategory(category) {
    const newCategory = {
      ...category,
      id: this.fragranceCategories.length + 1,
      createdAt: Date.now()
    };
    this.fragranceCategories.push(newCategory);
    return newCategory;
  }

  getFragranceCategories(filters = {}) {
    let categories = [...this.fragranceCategories];
    if (filters.code) {
      categories = categories.filter(c => c.code === filters.code);
    }
    if (filters.name) {
      categories = categories.filter(c => c.name.includes(filters.name));
    }
    return categories;
  }

  getFragranceCategoryById(id) {
    return this.fragranceCategories.find(c => c.id === id) || null;
  }

  getFragranceCategoryByCode(code) {
    return this.fragranceCategories.find(c => c.code === code) || null;
  }

  updateFragranceCategory(id, updates) {
    const category = this.fragranceCategories.find(c => c.id === id);
    if (category) {
      Object.assign(category, updates, { updatedAt: Date.now() });
    }
    return category;
  }

  deleteFragranceCategory(id) {
    const index = this.fragranceCategories.findIndex(c => c.id === id);
    if (index !== -1) {
      return this.fragranceCategories.splice(index, 1)[0];
    }
    return null;
  }

  addUsageScenario(scenario) {
    const newScenario = {
      ...scenario,
      id: this.usageScenarios.length + 1,
      createdAt: Date.now()
    };
    this.usageScenarios.push(newScenario);
    return newScenario;
  }

  getUsageScenarios(filters = {}) {
    let scenarios = [...this.usageScenarios];
    if (filters.code) {
      scenarios = scenarios.filter(s => s.code === filters.code);
    }
    if (filters.name) {
      scenarios = scenarios.filter(s => s.name.includes(filters.name));
    }
    return scenarios;
  }

  getUsageScenarioById(id) {
    return this.usageScenarios.find(s => s.id === id) || null;
  }

  getUsageScenarioByCode(code) {
    return this.usageScenarios.find(s => s.code === code) || null;
  }

  updateUsageScenario(id, updates) {
    const scenario = this.usageScenarios.find(s => s.id === id);
    if (scenario) {
      Object.assign(scenario, updates, { updatedAt: Date.now() });
    }
    return scenario;
  }

  deleteUsageScenario(id) {
    const index = this.usageScenarios.findIndex(s => s.id === id);
    if (index !== -1) {
      return this.usageScenarios.splice(index, 1)[0];
    }
    return null;
  }

  addMoodGoal(mood) {
    const newMood = {
      ...mood,
      id: this.moodGoals.length + 1,
      createdAt: Date.now()
    };
    this.moodGoals.push(newMood);
    return newMood;
  }

  getMoodGoals(filters = {}) {
    let moods = [...this.moodGoals];
    if (filters.code) {
      moods = moods.filter(m => m.code === filters.code);
    }
    if (filters.name) {
      moods = moods.filter(m => m.name.includes(filters.name));
    }
    return moods;
  }

  getMoodGoalById(id) {
    return this.moodGoals.find(m => m.id === id) || null;
  }

  getMoodGoalByCode(code) {
    return this.moodGoals.find(m => m.code === code) || null;
  }

  updateMoodGoal(id, updates) {
    const mood = this.moodGoals.find(m => m.id === id);
    if (mood) {
      Object.assign(mood, updates, { updatedAt: Date.now() });
    }
    return mood;
  }

  deleteMoodGoal(id) {
    const index = this.moodGoals.findIndex(m => m.id === id);
    if (index !== -1) {
      return this.moodGoals.splice(index, 1)[0];
    }
    return null;
  }

  addSeasonPreference(season) {
    const newSeason = {
      ...season,
      id: this.seasonPreferences.length + 1,
      createdAt: Date.now()
    };
    this.seasonPreferences.push(newSeason);
    return newSeason;
  }

  getSeasonPreferences(filters = {}) {
    let seasons = [...this.seasonPreferences];
    if (filters.code) {
      seasons = seasons.filter(s => s.code === filters.code);
    }
    if (filters.name) {
      seasons = seasons.filter(s => s.name.includes(filters.name));
    }
    return seasons;
  }

  getSeasonPreferenceById(id) {
    return this.seasonPreferences.find(s => s.id === id) || null;
  }

  getSeasonPreferenceByCode(code) {
    return this.seasonPreferences.find(s => s.code === code) || null;
  }

  updateSeasonPreference(id, updates) {
    const season = this.seasonPreferences.find(s => s.id === id);
    if (season) {
      Object.assign(season, updates, { updatedAt: Date.now() });
    }
    return season;
  }

  deleteSeasonPreference(id) {
    const index = this.seasonPreferences.findIndex(s => s.id === id);
    if (index !== -1) {
      return this.seasonPreferences.splice(index, 1)[0];
    }
    return null;
  }

  addUserRating(rating, userId) {
    const uid = normalizeUserId(userId);
    const parsedRating = parseNumber(rating.rating);
    if (parsedRating === null || parsedRating < 1 || parsedRating > 5) {
      throw new Error('评分必须在1-5之间');
    }

    const candle = rating.candleId ? this.getCandleById(rating.candleId) : null;
    if (!candle) {
      throw new Error('未找到对应的蜡烛信息');
    }

    const newRating = {
      ...rating,
      id: this.userRatings.length + 1,
      userId: uid,
      candleId: candle.id,
      brand: candle.brand,
      rating: parsedRating,
      timestamp: Date.now()
    };
    this.userRatings.push(newRating);
    return newRating;
  }

  getUserRatings(filters = {}) {
    const uid = filters.userId ? normalizeUserId(filters.userId) : null;
    let ratings = [...this.userRatings];
    if (uid) {
      ratings = ratings.filter(r => r && r.userId === uid);
    }
    if (filters.candleId) {
      ratings = ratings.filter(r => r && r.candleId === filters.candleId);
    }
    if (filters.brand) {
      ratings = ratings.filter(r => r && r.brand === filters.brand);
    }
    if (filters.minRating !== undefined) {
      ratings = ratings.filter(r => r && r.rating >= filters.minRating);
    }
    return ratings.sort((a, b) => b.timestamp - a.timestamp);
  }

  getScentConflict(scent1, scent2) {
    return this.conflictScentRules.find(r =>
      (r.scent1 === scent1 && r.scent2 === scent2) ||
      (r.scent1 === scent2 && r.scent2 === scent1)
    ) || null;
  }

  getAllConflictRules() {
    return [...this.conflictScentRules];
  }

  getSceneFragranceMapping(sceneCode) {
    return this.sceneFragranceMapping.filter(m => m.scene === sceneCode);
  }

  getMoodFragranceMapping(moodCode) {
    return this.moodFragranceMapping.filter(m => m.mood === moodCode);
  }

  getSeasonFragranceMapping(seasonCode) {
    return this.seasonFragranceMapping.filter(m => m.season === seasonCode);
  }

  saveUserScentPreferences(userId, preferences) {
    const uid = normalizeUserId(userId);
    const existing = this.userScentPreferences.get(uid) || {};

    const validatedPrefs = {};
    if (preferences.allergyTags && Array.isArray(preferences.allergyTags)) {
      const uniqueAllergies = [...new Set(preferences.allergyTags)];
      validatedPrefs.allergyTags = uniqueAllergies;
    }
    if (preferences.excludeTags && Array.isArray(preferences.excludeTags)) {
      const uniqueExcludes = [...new Set(preferences.excludeTags)];
      validatedPrefs.excludeTags = uniqueExcludes;
    }
    if (preferences.commonSpaces && Array.isArray(preferences.commonSpaces)) {
      validatedPrefs.commonSpaces = preferences.commonSpaces;
    }
    if (preferences.desiredMoods && Array.isArray(preferences.desiredMoods)) {
      validatedPrefs.desiredMoods = preferences.desiredMoods;
    }
    if (preferences.seasonPreference) {
      validatedPrefs.seasonPreference = preferences.seasonPreference;
    }
    if (preferences.weatherCondition) {
      validatedPrefs.weatherCondition = preferences.weatherCondition;
    }
    if (preferences.intensityPreference) {
      validatedPrefs.intensityPreference = preferences.intensityPreference;
    }

    const merged = {
      ...existing,
      ...validatedPrefs,
      userId: uid,
      lastUpdated: Date.now()
    };

    this.userScentPreferences.set(uid, merged);
    return merged;
  }

  getUserScentPreferences(userId) {
    const uid = normalizeUserId(userId);
    return this.userScentPreferences.get(uid) || null;
  }

  getCandlesByFragranceCategory(category) {
    return this.candles.filter(c => c.fragranceCategory === category);
  }

  getCandlesByScentTag(tagName) {
    return this.candles.filter(c => c.scentTags && c.scentTags.includes(tagName));
  }

  getCandlesByIntensity(intensity) {
    return this.candles.filter(c => c.intensity === intensity);
  }

  getAvailableInventoryCandles(userId) {
    const uid = userId ? normalizeUserId(userId) : DEFAULT_USER_ID;
    const inventory = this.getInventory({ userId: uid });
    return inventory
      .filter(item => item.quantity > 0)
      .map(item => {
        const candle = this.getCandleByBrandAndCapacity(item.brand, item.capacity);
        return candle ? { ...item, candle } : null;
      })
      .filter(Boolean);
  }

  getSafetyRules() {
    return [...this.safetyRules];
  }

  getSafetyRuleByCode(code) {
    return this.safetyRules.find(r => r.code === code) || null;
  }

  getSafetyRiskLevels() {
    return [...this.safetyRiskLevels];
  }

  getSafetyRiskLevelByScore(score) {
    return this.safetyRiskLevels.find(l => score >= l.minScore && score <= l.maxScore) || this.safetyRiskLevels[0];
  }

  getSafetyFactors() {
    return [...this.safetyFactors];
  }

  getSafetyFactorByCode(code) {
    return this.safetyFactors.find(f => f.code === code) || null;
  }

  saveRoomEnvironment(userId, roomCode, environment) {
    const uid = normalizeUserId(userId);
    const key = `${uid}:${roomCode}`;
    const existing = this.roomEnvironments.get(key) || {};
    const merged = {
      ...existing,
      ...environment,
      userId: uid,
      roomCode,
      lastUpdated: Date.now()
    };
    this.roomEnvironments.set(key, merged);
    return merged;
  }

  getRoomEnvironment(userId, roomCode) {
    const uid = normalizeUserId(userId);
    const key = `${uid}:${roomCode}`;
    return this.roomEnvironments.get(key) || null;
  }

  getAllRoomEnvironments(userId) {
    const uid = normalizeUserId(userId);
    return Array.from(this.roomEnvironments.entries())
      .filter(([key]) => key.startsWith(`${uid}:`))
      .map(([, env]) => env);
  }

  addBurningEvent(event, userId) {
    const uid = userId ? normalizeUserId(userId) : DEFAULT_USER_ID;
    const newEvent = {
      ...event,
      id: this.burningEvents.length + 1,
      userId: uid,
      timestamp: Date.now()
    };
    this.burningEvents.push(newEvent);
    return newEvent;
  }

  getBurningEvents(filters = {}) {
    const uid = filters.userId ? normalizeUserId(filters.userId) : DEFAULT_USER_ID;
    let events = this.burningEvents.filter(e => e && e.userId === uid);
    if (filters.candleId) {
      events = events.filter(e => e && e.candleId === filters.candleId);
    }
    if (filters.eventType) {
      events = events.filter(e => e && e.eventType === filters.eventType);
    }
    if (filters.roomCode) {
      events = events.filter(e => e && e.roomCode === filters.roomCode);
    }
    return events.sort((a, b) => b.timestamp - a.timestamp);
  }

  getActiveBurningSession(userId, candleId) {
    const uid = normalizeUserId(userId);
    const igniteEvents = this.burningEvents.filter(e =>
      e && e.userId === uid && e.candleId === candleId && e.eventType === 'ignite'
    );
    const extinguishEvents = this.burningEvents.filter(e =>
      e && e.userId === uid && e.candleId === candleId && e.eventType === 'extinguish'
    );

    if (igniteEvents.length === 0) return null;

    const lastIgnite = igniteEvents.sort((a, b) => b.timestamp - a.timestamp)[0];
    const lastExtinguish = extinguishEvents.length > 0
      ? extinguishEvents.sort((a, b) => b.timestamp - a.timestamp)[0]
      : null;

    if (!lastExtinguish || lastExtinguish.timestamp < lastIgnite.timestamp) {
      const currentDuration = (Date.now() - lastIgnite.timestamp) / (1000 * 60 * 60);
      return {
        candleId,
        igniteTime: lastIgnite.timestamp,
        currentDurationHours: Number(currentDuration.toFixed(2)),
        roomCode: lastIgnite.roomCode || null,
        isActive: true
      };
    }

    return null;
  }

  addSafetyInspectionRecord(record, userId) {
    const uid = userId ? normalizeUserId(userId) : DEFAULT_USER_ID;
    const newRecord = {
      ...record,
      id: this.safetyInspectionRecords.length + 1,
      userId: uid,
      timestamp: Date.now()
    };
    this.safetyInspectionRecords.push(newRecord);
    return newRecord;
  }

  getSafetyInspectionRecords(filters = {}) {
    const uid = filters.userId ? normalizeUserId(filters.userId) : DEFAULT_USER_ID;
    let records = this.safetyInspectionRecords.filter(r => r && r.userId === uid);
    if (filters.candleId) {
      records = records.filter(r => r && r.candleId === filters.candleId);
    }
    if (filters.roomCode) {
      records = records.filter(r => r && r.roomCode === filters.roomCode);
    }
    if (filters.inspectionType) {
      records = records.filter(r => r && r.inspectionType === filters.inspectionType);
    }
    return records.sort((a, b) => b.timestamp - a.timestamp);
  }

  saveUserSafetyProfile(userId, profile) {
    const uid = normalizeUserId(userId);
    const existing = this.userSafetyProfiles.get(uid) || {};
    const merged = {
      ...existing,
      ...profile,
      userId: uid,
      lastUpdated: Date.now()
    };
    this.userSafetyProfiles.set(uid, merged);
    return merged;
  }

  getUserSafetyProfile(userId) {
    const uid = normalizeUserId(userId);
    return this.userSafetyProfiles.get(uid) || null;
  }

  addSafetyAlert(alert, userId) {
    const uid = userId ? normalizeUserId(userId) : DEFAULT_USER_ID;
    const newAlert = {
      ...alert,
      id: this.safetyAlerts.length + 1,
      userId: uid,
      timestamp: Date.now(),
      acknowledged: false
    };
    this.safetyAlerts.push(newAlert);
    return newAlert;
  }

  getSafetyAlerts(filters = {}) {
    const uid = filters.userId ? normalizeUserId(filters.userId) : DEFAULT_USER_ID;
    let alerts = this.safetyAlerts.filter(a => a && a.userId === uid);
    if (filters.roomCode) {
      alerts = alerts.filter(a => a && a.roomCode === filters.roomCode);
    }
    if (filters.alertType) {
      alerts = alerts.filter(a => a && a.alertType === filters.alertType);
    }
    if (filters.acknowledged !== undefined) {
      alerts = alerts.filter(a => a && a.acknowledged === filters.acknowledged);
    }
    return alerts.sort((a, b) => b.timestamp - a.timestamp);
  }

  acknowledgeSafetyAlert(alertId, userId) {
    const uid = normalizeUserId(userId);
    const alert = this.safetyAlerts.find(a => a.id === alertId && a.userId === uid);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = Date.now();
    }
    return alert;
  }
}

const storage = new MemoryStorage();

module.exports = {
  storage,
  isValidUserId,
  normalizeUserId,
  DEFAULT_USER_ID
};
