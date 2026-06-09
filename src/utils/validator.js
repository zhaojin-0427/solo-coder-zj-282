function parseNumber(value) {
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const num = Number(trimmed);
    return isNaN(num) ? null : num;
  }
  return null;
}

function parseInteger(value) {
  const num = parseNumber(value);
  if (num === null) return null;
  return Math.floor(num) === num ? num : null;
}

function parsePositiveInteger(value) {
  const num = parseInteger(value);
  if (num === null || num < 0) return null;
  return num;
}

function parseStrictPositiveInteger(value) {
  const num = parseInteger(value);
  if (num === null || num <= 0) return null;
  return num;
}

function parsePositiveNumber(value) {
  const num = parseNumber(value);
  if (num === null || num < 0) return null;
  return num;
}

function isValidNumber(value) {
  return parseNumber(value) !== null;
}

function isValidPositiveInteger(value) {
  return parsePositiveInteger(value) !== null;
}

function isValidStrictPositiveInteger(value) {
  return parseStrictPositiveInteger(value) !== null;
}

function isValidPositiveNumber(value) {
  return parsePositiveNumber(value) !== null;
}

function normalizeCapacity(capacity) {
  return parseInteger(capacity);
}

function normalizeQuantity(quantity) {
  return parsePositiveInteger(quantity);
}

function isValidUserId(userId) {
  if (userId === undefined || userId === null) return false;
  if (typeof userId !== 'string') return false;
  const trimmed = userId.trim();
  return trimmed.length > 0 && trimmed.length <= 64;
}

function validateUserId(userId, required = true) {
  if (!required && (userId === undefined || userId === null)) {
    return { valid: true, data: undefined };
  }
  if (!isValidUserId(userId)) {
    return { valid: false, errors: ['userId 非法，必须是1-64位的非空字符串'] };
  }
  return { valid: true, data: userId.trim() };
}

function validatePredictionDays(days) {
  if (days === undefined || days === null) {
    return { valid: true, data: 7 };
  }
  const num = parseInteger(days);
  if (num === null) {
    return { valid: false, errors: ['预测天数必须是有效的整数'] };
  }
  if (![7, 14, 30].includes(num)) {
    return { valid: false, errors: ['预测天数必须是 7、14 或 30 天'] };
  }
  return { valid: true, data: num };
}

function validateScene(scene, required = false) {
  if (!required && (scene === undefined || scene === null)) {
    return { valid: true, data: undefined };
  }
  if (typeof scene !== 'string') {
    return { valid: false, errors: ['scene 必须是字符串'] };
  }
  const trimmed = scene.trim();
  if (trimmed.length === 0 || trimmed.length > 32) {
    return { valid: false, errors: ['scene 长度必须在1-32字符之间'] };
  }
  return { valid: true, data: trimmed };
}

function validateBurningRecord(body) {
  const errors = [];
  const result = {};

  if (!body.candleId && !body.brand) {
    errors.push('candleId 或 brand 至少提供一个');
  } else {
    if (body.candleId !== undefined) {
      const candleId = parsePositiveInteger(body.candleId);
      if (candleId === null) {
        errors.push('candleId 必须是有效的正整数');
      } else {
        result.candleId = candleId;
      }
    }
    if (body.brand !== undefined) {
      if (typeof body.brand !== 'string' || body.brand.trim() === '') {
        errors.push('brand 必须是非空字符串');
      } else {
        result.brand = body.brand.trim();
      }
    }
  }

  if (body.burnHours === undefined) {
    errors.push('burnHours 为必填项');
  } else {
    const burnHours = parsePositiveNumber(body.burnHours);
    if (burnHours === null || burnHours <= 0) {
      errors.push('burnHours 必须是有效的正数且大于0');
    } else {
      result.burnHours = burnHours;
    }
  }

  if (body.actualBurned === undefined) {
    errors.push('actualBurned 为必填项，半截燃烧记录无效');
  } else {
    const actualBurned = parsePositiveNumber(body.actualBurned);
    if (actualBurned === null || actualBurned <= 0) {
      errors.push('actualBurned 必须是有效的正数且大于0，半截燃烧记录无效');
    } else {
      result.actualBurned = actualBurned;
    }
  }

  if (body.capacity !== undefined) {
    const capacity = normalizeCapacity(body.capacity);
    if (capacity === null || capacity <= 0) {
      errors.push('capacity 必须是有效的正整数');
    } else {
      result.capacity = capacity;
    }
  }

  if (body.temperature !== undefined) {
    const temp = parseNumber(body.temperature);
    if (temp === null) {
      errors.push('temperature 必须是有效的数字');
    } else if (temp < -40 || temp > 60) {
      errors.push('temperature 必须在合理范围内 (-40 ~ 60)');
    } else {
      result.temperature = temp;
    }
  }

  if (body.humidity !== undefined) {
    const humidity = parseNumber(body.humidity);
    if (humidity === null) {
      errors.push('humidity 必须是有效的数字');
    } else if (humidity < 0 || humidity > 100) {
      errors.push('humidity 必须在合理范围内 (0 ~ 100)');
    } else {
      result.humidity = humidity;
    }
  }

  const sceneValidation = validateScene(body.scene, false);
  if (!sceneValidation.valid) {
    errors.push(...sceneValidation.errors);
  } else if (sceneValidation.data !== undefined) {
    result.scene = sceneValidation.data;
  }

  return {
    valid: errors.length === 0,
    errors,
    data: result
  };
}

function validateInventoryReport(body) {
  const errors = [];
  const result = {};

  if (!body.brand || typeof body.brand !== 'string' || body.brand.trim() === '') {
    errors.push('brand 不能为空且必须是字符串');
  } else {
    result.brand = body.brand.trim();
  }

  const capacity = normalizeCapacity(body.capacity);
  if (capacity === null || capacity <= 0) {
    errors.push('capacity 必须是有效的正整数且大于0');
  } else {
    result.capacity = capacity;
  }

  const quantity = normalizeQuantity(body.quantity);
  if (quantity === null || quantity < 0) {
    errors.push('quantity 必须是有效的非负整数，不允许负数库存');
  } else {
    result.quantity = quantity;
  }

  if (body.actualBurned !== undefined) {
    const actualBurned = parsePositiveNumber(body.actualBurned);
    if (actualBurned === null || actualBurned < 0) {
      errors.push('actualBurned 必须是有效的非负数');
    } else {
      result.actualBurned = actualBurned;
    }
  }

  if (body.burnHours !== undefined) {
    const burnHours = parsePositiveNumber(body.burnHours);
    if (burnHours === null || burnHours <= 0) {
      errors.push('burnHours 必须是有效的正数且大于0');
    } else {
      result.burnHours = burnHours;
    }
  }

  if (body.burnHours !== undefined || body.actualBurned !== undefined) {
    if (body.burnHours !== undefined && body.actualBurned === undefined) {
      errors.push('提供 burnHours 时必须同时提供 actualBurned，半截燃烧记录无效');
    }
    if (body.actualBurned !== undefined && body.burnHours === undefined) {
      errors.push('提供 actualBurned 时必须同时提供 burnHours，半截燃烧记录无效');
    }
    if (body.burnHours !== undefined && body.actualBurned !== undefined) {
      if (body.burnHours > 0 && body.actualBurned <= 0) {
        errors.push('burnHours 和 actualBurned 必须同时为有效正数，半截燃烧记录无效');
      }
      if (body.actualBurned > 0 && body.burnHours <= 0) {
        errors.push('burnHours 和 actualBurned 必须同时为有效正数，半截燃烧记录无效');
      }
    }
  }

  if (body.temperature !== undefined) {
    const temp = parseNumber(body.temperature);
    if (temp === null) {
      errors.push('temperature 必须是有效的数字');
    } else if (temp < -40 || temp > 60) {
      errors.push('temperature 必须在合理范围内 (-40 ~ 60)');
    } else {
      result.temperature = temp;
    }
  }

  if (body.humidity !== undefined) {
    const humidity = parseNumber(body.humidity);
    if (humidity === null) {
      errors.push('humidity 必须是有效的数字');
    } else if (humidity < 0 || humidity > 100) {
      errors.push('humidity 必须在合理范围内 (0 ~ 100)');
    } else {
      result.humidity = humidity;
    }
  }

  const sceneValidation = validateScene(body.scene, false);
  if (!sceneValidation.valid) {
    errors.push(...sceneValidation.errors);
  } else if (sceneValidation.data !== undefined) {
    result.scene = sceneValidation.data;
  }

  if (body.userId !== undefined) {
    const userIdValidation = validateUserId(body.userId, false);
    if (!userIdValidation.valid) {
      errors.push(...userIdValidation.errors);
    } else if (userIdValidation.data !== undefined) {
      result.userId = userIdValidation.data;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data: result
  };
}

function validateReplenishmentList(body) {
  const errors = [];
  const result = {};

  const userIdValidation = validateUserId(body.userId, true);
  if (!userIdValidation.valid) {
    errors.push(...userIdValidation.errors);
  } else {
    result.userId = userIdValidation.data;
  }

  const daysValidation = validatePredictionDays(body.days);
  if (!daysValidation.valid) {
    errors.push(...daysValidation.errors);
  } else {
    result.days = daysValidation.data;
  }

  return {
    valid: errors.length === 0,
    errors,
    data: result
  };
}

function validateUserIdConflict(queryUserId, bodyUserId) {
  const queryHas = queryUserId !== undefined && queryUserId !== null && queryUserId !== '';
  const bodyHas = bodyUserId !== undefined && bodyUserId !== null;

  if (!queryHas && !bodyHas) {
    return { valid: false, errors: ['userId 为必填项'], data: null };
  }

  if (queryHas && bodyHas) {
    const queryTrimmed = String(queryUserId).trim();
    const bodyTrimmed = typeof bodyUserId === 'string' ? bodyUserId.trim() : String(bodyUserId);

    if (queryTrimmed !== bodyTrimmed) {
      return {
        valid: false,
        errors: [`query 中的 userId (${queryTrimmed}) 与 body 中的 userId (${bodyTrimmed}) 不一致，请只传一个`],
        data: null
      };
    }
  }

  const userId = queryHas ? queryUserId : bodyUserId;
  return validateUserId(userId, true);
}

function validateRating(rating) {
  const num = parseNumber(rating);
  if (num === null) {
    return { valid: false, errors: ['评分必须是有效的数字'] };
  }
  if (num < 1 || num > 5) {
    return { valid: false, errors: ['评分必须在1-5之间'] };
  }
  return { valid: true, data: Math.round(num * 10) / 10 };
}

function validateScentTag(body) {
  const errors = [];
  const result = {};

  if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
    errors.push('name 不能为空且必须是字符串');
  } else {
    const trimmed = body.name.trim();
    if (trimmed.length > 32) {
      errors.push('name 长度不能超过32个字符');
    }
    result.name = trimmed;
  }

  if (body.category !== undefined) {
    if (typeof body.category !== 'string' || body.category.trim() === '') {
      errors.push('category 必须是非空字符串');
    } else {
      result.category = body.category.trim();
    }
  }

  if (body.description !== undefined) {
    if (typeof body.description !== 'string') {
      errors.push('description 必须是字符串');
    } else if (body.description.length > 200) {
      errors.push('description 长度不能超过200个字符');
    } else {
      result.description = body.description.trim();
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data: result
  };
}

function validateFragranceCategory(body) {
  const errors = [];
  const result = {};

  if (!body.code || typeof body.code !== 'string' || body.code.trim() === '') {
    errors.push('code 不能为空且必须是字符串');
  } else {
    const trimmed = body.code.trim();
    if (!/^[a-z_]+$/.test(trimmed)) {
      errors.push('code 只能包含小写字母和下划线');
    }
    if (trimmed.length > 32) {
      errors.push('code 长度不能超过32个字符');
    }
    result.code = trimmed;
  }

  if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
    errors.push('name 不能为空且必须是字符串');
  } else {
    const trimmed = body.name.trim();
    if (trimmed.length > 32) {
      errors.push('name 长度不能超过32个字符');
    }
    result.name = trimmed;
  }

  if (body.description !== undefined) {
    if (typeof body.description !== 'string') {
      errors.push('description 必须是字符串');
    } else if (body.description.length > 200) {
      errors.push('description 长度不能超过200个字符');
    } else {
      result.description = body.description.trim();
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data: result
  };
}

function validateUsageScenario(body) {
  const errors = [];
  const result = {};

  if (!body.code || typeof body.code !== 'string' || body.code.trim() === '') {
    errors.push('code 不能为空且必须是字符串');
  } else {
    const trimmed = body.code.trim();
    if (!/^[a-z_]+$/.test(trimmed)) {
      errors.push('code 只能包含小写字母和下划线');
    }
    if (trimmed.length > 32) {
      errors.push('code 长度不能超过32个字符');
    }
    result.code = trimmed;
  }

  if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
    errors.push('name 不能为空且必须是字符串');
  } else {
    const trimmed = body.name.trim();
    if (trimmed.length > 32) {
      errors.push('name 长度不能超过32个字符');
    }
    result.name = trimmed;
  }

  if (body.description !== undefined) {
    if (typeof body.description !== 'string') {
      errors.push('description 必须是字符串');
    } else if (body.description.length > 200) {
      errors.push('description 长度不能超过200个字符');
    } else {
      result.description = body.description.trim();
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data: result
  };
}

function validateMoodGoal(body) {
  const errors = [];
  const result = {};

  if (!body.code || typeof body.code !== 'string' || body.code.trim() === '') {
    errors.push('code 不能为空且必须是字符串');
  } else {
    const trimmed = body.code.trim();
    if (!/^[a-z_]+$/.test(trimmed)) {
      errors.push('code 只能包含小写字母和下划线');
    }
    if (trimmed.length > 32) {
      errors.push('code 长度不能超过32个字符');
    }
    result.code = trimmed;
  }

  if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
    errors.push('name 不能为空且必须是字符串');
  } else {
    const trimmed = body.name.trim();
    if (trimmed.length > 32) {
      errors.push('name 长度不能超过32个字符');
    }
    result.name = trimmed;
  }

  if (body.description !== undefined) {
    if (typeof body.description !== 'string') {
      errors.push('description 必须是字符串');
    } else if (body.description.length > 200) {
      errors.push('description 长度不能超过200个字符');
    } else {
      result.description = body.description.trim();
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data: result
  };
}

function validateSeasonPreference(body) {
  const errors = [];
  const result = {};

  if (!body.code || typeof body.code !== 'string' || body.code.trim() === '') {
    errors.push('code 不能为空且必须是字符串');
  } else {
    const trimmed = body.code.trim();
    if (!/^[a-z_]+$/.test(trimmed)) {
      errors.push('code 只能包含小写字母和下划线');
    }
    if (trimmed.length > 32) {
      errors.push('code 长度不能超过32个字符');
    }
    result.code = trimmed;
  }

  if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
    errors.push('name 不能为空且必须是字符串');
  } else {
    const trimmed = body.name.trim();
    if (trimmed.length > 32) {
      errors.push('name 长度不能超过32个字符');
    }
    result.name = trimmed;
  }

  if (body.description !== undefined) {
    if (typeof body.description !== 'string') {
      errors.push('description 必须是字符串');
    } else if (body.description.length > 200) {
      errors.push('description 长度不能超过200个字符');
    } else {
      result.description = body.description.trim();
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data: result
  };
}

function validateUserRating(body) {
  const errors = [];
  const result = {};

  if (body.candleId === undefined || body.candleId === null) {
    errors.push('candleId 为必填项');
  } else {
    const candleId = parsePositiveInteger(body.candleId);
    if (candleId === null || candleId <= 0) {
      errors.push('candleId 必须是有效的正整数');
    } else {
      result.candleId = candleId;
    }
  }

  const ratingValidation = validateRating(body.rating);
  if (!ratingValidation.valid) {
    errors.push(...ratingValidation.errors);
  } else {
    result.rating = ratingValidation.data;
  }

  if (body.comment !== undefined) {
    if (typeof body.comment !== 'string') {
      errors.push('comment 必须是字符串');
    } else if (body.comment.length > 500) {
      errors.push('comment 长度不能超过500个字符');
    } else {
      result.comment = body.comment.trim();
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data: result
  };
}

function validateStringArray(arr, fieldName, maxLength = 32, required = false) {
  if (!required && (arr === undefined || arr === null)) {
    return { valid: true, data: undefined };
  }

  if (!Array.isArray(arr)) {
    return { valid: false, errors: [`${fieldName} 必须是数组`] };
  }

  if (arr.length === 0) {
    return { valid: false, errors: [`${fieldName} 不能为空数组`] };
  }

  const result = [];
  const seen = new Set();
  const errors = [];

  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (typeof item !== 'string' || item.trim() === '') {
      errors.push(`${fieldName}[${i}] 必须是非空字符串`);
      continue;
    }
    const trimmed = item.trim();
    if (trimmed.length > maxLength) {
      errors.push(`${fieldName}[${i}] 长度不能超过${maxLength}个字符`);
      continue;
    }
    if (seen.has(trimmed)) {
      errors.push(`${fieldName} 中存在重复标签: ${trimmed}`);
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }

  return {
    valid: errors.length === 0,
    errors,
    data: result
  };
}

function validateSeasonCode(code) {
  const validSeasons = ['spring', 'summer', 'autumn', 'winter'];
  if (!validSeasons.includes(code)) {
    return { valid: false, errors: [`季节必须是以下值之一: ${validSeasons.join(', ')}`] };
  }
  return { valid: true, data: code };
}

function validateIntensity(intensity) {
  const validIntensities = ['light', 'medium', 'strong'];
  if (!validIntensities.includes(intensity)) {
    return { valid: false, errors: [`浓度必须是以下值之一: ${validIntensities.join(', ')}`] };
  }
  return { valid: true, data: intensity };
}

function validateWeather(weather) {
  const validWeathers = ['sunny', 'cloudy', 'rainy', 'snowy', 'humid', 'dry'];
  if (!validWeathers.includes(weather)) {
    return { valid: false, errors: [`天气必须是以下值之一: ${validWeathers.join(', ')}`] };
  }
  return { valid: true, data: weather };
}

function validateUserScentPreferences(body) {
  const errors = [];
  const result = {};

  if (body.allergyTags !== undefined) {
    const allergyValidation = validateStringArray(body.allergyTags, 'allergyTags', 32, false);
    if (!allergyValidation.valid) {
      errors.push(...allergyValidation.errors);
    } else if (allergyValidation.data !== undefined) {
      result.allergyTags = allergyValidation.data;
    }
  }

  if (body.excludeTags !== undefined) {
    const excludeValidation = validateStringArray(body.excludeTags, 'excludeTags', 32, false);
    if (!excludeValidation.valid) {
      errors.push(...excludeValidation.errors);
    } else if (excludeValidation.data !== undefined) {
      result.excludeTags = excludeValidation.data;
    }
  }

  if (body.commonSpaces !== undefined) {
    const spacesValidation = validateStringArray(body.commonSpaces, 'commonSpaces', 32, false);
    if (!spacesValidation.valid) {
      errors.push(...spacesValidation.errors);
    } else if (spacesValidation.data !== undefined) {
      result.commonSpaces = spacesValidation.data;
    }
  }

  if (body.desiredMoods !== undefined) {
    const moodsValidation = validateStringArray(body.desiredMoods, 'desiredMoods', 32, false);
    if (!moodsValidation.valid) {
      errors.push(...moodsValidation.errors);
    } else if (moodsValidation.data !== undefined) {
      result.desiredMoods = moodsValidation.data;
    }
  }

  if (body.seasonPreference !== undefined) {
    const seasonValidation = validateSeasonCode(body.seasonPreference);
    if (!seasonValidation.valid) {
      errors.push(...seasonValidation.errors);
    } else {
      result.seasonPreference = seasonValidation.data;
    }
  }

  if (body.weatherCondition !== undefined) {
    const weatherValidation = validateWeather(body.weatherCondition);
    if (!weatherValidation.valid) {
      errors.push(...weatherValidation.errors);
    } else {
      result.weatherCondition = weatherValidation.data;
    }
  }

  if (body.intensityPreference !== undefined) {
    const intensityValidation = validateIntensity(body.intensityPreference);
    if (!intensityValidation.valid) {
      errors.push(...intensityValidation.errors);
    } else {
      result.intensityPreference = intensityValidation.data;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data: result
  };
}

function validateRecommendationQuery(body) {
  const errors = [];
  const result = {};

  if (body.scene !== undefined && body.scene !== null) {
    if (typeof body.scene !== 'string' || body.scene.trim() === '') {
      errors.push('scene 必须是非空字符串');
    } else {
      result.scene = body.scene.trim();
    }
  }

  if (body.mood !== undefined && body.mood !== null) {
    if (typeof body.mood !== 'string' || body.mood.trim() === '') {
      errors.push('mood 必须是非空字符串');
    } else {
      result.mood = body.mood.trim();
    }
  }

  if (body.season !== undefined && body.season !== null) {
    const seasonValidation = validateSeasonCode(body.season);
    if (!seasonValidation.valid) {
      errors.push(...seasonValidation.errors);
    } else {
      result.season = seasonValidation.data;
    }
  }

  if (body.roomSize !== undefined && body.roomSize !== null) {
    const roomSize = parseNumber(body.roomSize);
    if (roomSize === null || roomSize <= 0) {
      errors.push('roomSize 必须是有效的正数');
    } else {
      result.roomSize = roomSize;
    }
  }

  if (body.maxCandles !== undefined && body.maxCandles !== null) {
    const max = parsePositiveInteger(body.maxCandles);
    if (max === null || max <= 0 || max > 10) {
      errors.push('maxCandles 必须是1-10之间的正整数');
    } else {
      result.maxCandles = max;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data: result
  };
}

module.exports = {
  parseNumber,
  parseInteger,
  parsePositiveInteger,
  parseStrictPositiveInteger,
  parsePositiveNumber,
  isValidNumber,
  isValidPositiveInteger,
  isValidStrictPositiveInteger,
  isValidPositiveNumber,
  normalizeCapacity,
  normalizeQuantity,
  isValidUserId,
  validateUserId,
  validateUserIdConflict,
  validatePredictionDays,
  validateScene,
  validateBurningRecord,
  validateInventoryReport,
  validateReplenishmentList,
  validateScentTag,
  validateFragranceCategory,
  validateUsageScenario,
  validateMoodGoal,
  validateSeasonPreference,
  validateUserRating,
  validateUserScentPreferences,
  validateRecommendationQuery,
  validateRating,
  validateStringArray,
  validateSeasonCode,
  validateIntensity,
  validateWeather
};
