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

function validateBoolean(value, fieldName, required = false) {
  if (!required && (value === undefined || value === null)) {
    return { valid: true, data: undefined };
  }
  if (typeof value === 'boolean') {
    return { valid: true, data: value };
  }
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase();
    if (lower === 'true') return { valid: true, data: true };
    if (lower === 'false') return { valid: true, data: false };
  }
  return { valid: false, errors: [`${fieldName} 必须是布尔值 (true/false)`] };
}

function validateEventType(eventType) {
  const validTypes = ['ignite', 'extinguish', 'check'];
  if (!validTypes.includes(eventType)) {
    return { valid: false, errors: [`事件类型必须是以下值之一: ${validTypes.join(', ')}`] };
  }
  return { valid: true, data: eventType };
}

function validateInspectionType(inspectionType) {
  const validTypes = ['pre_use', 'during_use', 'post_use', 'environment', 'full'];
  if (!validTypes.includes(inspectionType)) {
    return { valid: false, errors: [`检查类型必须是以下值之一: ${validTypes.join(', ')}`] };
  }
  return { valid: true, data: inspectionType };
}

function validateDistance(distance, fieldName, required = false) {
  if (!required && (distance === undefined || distance === null)) {
    return { valid: true, data: undefined };
  }
  const num = parsePositiveNumber(distance);
  if (num === null || num < 0 || num > 1000) {
    return { valid: false, errors: [`${fieldName} 必须是0-1000之间的有效数字（单位：cm）`] };
  }
  return { valid: true, data: num };
}

function validateWickLength(length, required = false) {
  if (!required && (length === undefined || length === null)) {
    return { valid: true, data: undefined };
  }
  const num = parsePositiveNumber(length);
  if (num === null || num < 0 || num > 50) {
    return { valid: false, errors: [`烛芯长度必须是0-50之间的有效数字（单位：mm）`] };
  }
  return { valid: true, data: num };
}

function validateSafetyInspection(body) {
  const errors = [];
  const result = {};

  const inspectionTypeValidation = validateInspectionType(body.inspectionType);
  if (!inspectionTypeValidation.valid) {
    errors.push(...inspectionTypeValidation.errors);
  } else {
    result.inspectionType = inspectionTypeValidation.data;
  }

  if (body.candleId !== undefined && body.candleId !== null) {
    const candleId = parsePositiveInteger(body.candleId);
    if (candleId === null || candleId <= 0) {
      errors.push('candleId 必须是有效的正整数');
    } else {
      result.candleId = candleId;
    }
  }

  const sceneValidation = validateScene(body.roomCode, false);
  if (!sceneValidation.valid) {
    errors.push(...sceneValidation.errors);
  } else if (sceneValidation.data !== undefined) {
    result.roomCode = sceneValidation.data;
  }

  if (body.temperature !== undefined) {
    const temp = parseNumber(body.temperature);
    if (temp === null) {
      errors.push('temperature 必须是有效的数字');
    } else if (temp < -40 || temp > 60) {
      errors.push('temperature 必须在合理范围内 (-40 ~ 60°C)');
    } else {
      result.temperature = temp;
    }
  }

  if (body.humidity !== undefined) {
    const humidity = parseNumber(body.humidity);
    if (humidity === null) {
      errors.push('humidity 必须是有效的数字');
    } else if (humidity < 0 || humidity > 100) {
      errors.push('humidity 必须在合理范围内 (0 ~ 100%)');
    } else {
      result.humidity = humidity;
    }
  }

  const combustibleDistValidation = validateDistance(body.combustibleDistance, 'combustibleDistance', false);
  if (!combustibleDistValidation.valid) {
    errors.push(...combustibleDistValidation.errors);
  } else if (combustibleDistValidation.data !== undefined) {
    result.combustibleDistance = combustibleDistValidation.data;
  }

  const ventilationDistValidation = validateDistance(body.ventilationDistance, 'ventilationDistance', false);
  if (!ventilationDistValidation.valid) {
    errors.push(...ventilationDistValidation.errors);
  } else if (ventilationDistValidation.data !== undefined) {
    result.ventilationDistance = ventilationDistValidation.data;
  }

  const wickLengthValidation = validateWickLength(body.wickLength, false);
  if (!wickLengthValidation.valid) {
    errors.push(...wickLengthValidation.errors);
  } else if (wickLengthValidation.data !== undefined) {
    result.wickLength = wickLengthValidation.data;
  }

  const childValidation = validateBoolean(body.hasChild, 'hasChild', false);
  if (!childValidation.valid) {
    errors.push(...childValidation.errors);
  } else if (childValidation.data !== undefined) {
    result.hasChild = childValidation.data;
  }

  const petValidation = validateBoolean(body.hasPet, 'hasPet', false);
  if (!petValidation.valid) {
    errors.push(...petValidation.errors);
  } else if (petValidation.data !== undefined) {
    result.hasPet = petValidation.data;
  }

  const ventilationValidation = validateBoolean(body.isPoorVentilation, 'isPoorVentilation', false);
  if (!ventilationValidation.valid) {
    errors.push(...ventilationValidation.errors);
  } else if (ventilationValidation.data !== undefined) {
    result.isPoorVentilation = ventilationValidation.data;
  }

  const passedValidation = validateBoolean(body.passed, 'passed', false);
  if (!passedValidation.valid) {
    errors.push(...passedValidation.errors);
  } else if (passedValidation.data !== undefined) {
    result.passed = passedValidation.data;
  }

  if (body.notes !== undefined) {
    if (typeof body.notes !== 'string') {
      errors.push('notes 必须是字符串');
    } else if (body.notes.length > 500) {
      errors.push('notes 长度不能超过500个字符');
    } else {
      result.notes = body.notes.trim();
    }
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

function validateBurningEvent(body) {
  const errors = [];
  const result = {};

  const eventTypeValidation = validateEventType(body.eventType);
  if (!eventTypeValidation.valid) {
    errors.push(...eventTypeValidation.errors);
  } else {
    result.eventType = eventTypeValidation.data;
  }

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

  const sceneValidation = validateScene(body.roomCode, false);
  if (!sceneValidation.valid) {
    errors.push(...sceneValidation.errors);
  } else if (sceneValidation.data !== undefined) {
    result.roomCode = sceneValidation.data;
  }

  if (body.temperature !== undefined) {
    const temp = parseNumber(body.temperature);
    if (temp === null) {
      errors.push('temperature 必须是有效的数字');
    } else if (temp < -40 || temp > 60) {
      errors.push('temperature 必须在合理范围内 (-40 ~ 60°C)');
    } else {
      result.temperature = temp;
    }
  }

  if (body.humidity !== undefined) {
    const humidity = parseNumber(body.humidity);
    if (humidity === null) {
      errors.push('humidity 必须是有效的数字');
    } else if (humidity < 0 || humidity > 100) {
      errors.push('humidity 必须在合理范围内 (0 ~ 100%)');
    } else {
      result.humidity = humidity;
    }
  }

  if (body.userId !== undefined) {
    const userIdValidation = validateUserId(body.userId, false);
    if (!userIdValidation.valid) {
      errors.push(...userIdValidation.errors);
    } else if (userIdValidation.data !== undefined) {
      result.userId = userIdValidation.data;
    }
  }

  if (body.notes !== undefined) {
    if (typeof body.notes !== 'string') {
      errors.push('notes 必须是字符串');
    } else if (body.notes.length > 500) {
      errors.push('notes 长度不能超过500个字符');
    } else {
      result.notes = body.notes.trim();
    }
  }

  if (body.burnHours !== undefined && body.burnHours !== null) {
    const hours = parseNumber(body.burnHours);
    if (hours === null) {
      errors.push('burnHours 必须是有效的数字');
    } else if (hours < 0) {
      errors.push('burnHours 不能为负数');
    } else if (hours > 72) {
      errors.push('burnHours 不能超过72小时');
    } else {
      result.burnHours = hours;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data: result
  };
}

function validateRiskAssessmentQuery(query) {
  const errors = [];
  const result = {};

  if (query.candleId !== undefined && query.candleId !== null && query.candleId !== '') {
    const candleId = parseStrictPositiveInteger(query.candleId);
    if (candleId === null) {
      errors.push('candleId 必须是有效的正整数');
    } else {
      result.candleId = candleId;
    }
  }

  const sceneValidation = validateScene(query.roomCode, false);
  if (!sceneValidation.valid) {
    errors.push(...sceneValidation.errors);
  } else if (sceneValidation.data !== undefined) {
    result.roomCode = sceneValidation.data;
  }

  if (query.temperature !== undefined && query.temperature !== '') {
    const temp = parseNumber(query.temperature);
    if (temp === null) {
      errors.push('temperature 必须是有效的数字');
    } else if (temp < -40 || temp > 60) {
      errors.push('temperature 必须在合理范围内 (-40 ~ 60°C)');
    } else {
      result.temperature = temp;
    }
  }

  if (query.humidity !== undefined && query.humidity !== '') {
    const humidity = parseNumber(query.humidity);
    if (humidity === null) {
      errors.push('humidity 必须是有效的数字');
    } else if (humidity < 0 || humidity > 100) {
      errors.push('humidity 必须在合理范围内 (0 ~ 100%)');
    } else {
      result.humidity = humidity;
    }
  }

  const childValidation = validateBoolean(query.hasChild, 'hasChild', false);
  if (!childValidation.valid) {
    errors.push(...childValidation.errors);
  } else if (childValidation.data !== undefined) {
    result.hasChild = childValidation.data;
  }

  const petValidation = validateBoolean(query.hasPet, 'hasPet', false);
  if (!petValidation.valid) {
    errors.push(...petValidation.errors);
  } else if (petValidation.data !== undefined) {
    result.hasPet = petValidation.data;
  }

  const ventilationValidation = validateBoolean(query.isPoorVentilation, 'isPoorVentilation', false);
  if (!ventilationValidation.valid) {
    errors.push(...ventilationValidation.errors);
  } else if (ventilationValidation.data !== undefined) {
    result.isPoorVentilation = ventilationValidation.data;
  }

  if (query.combustibleDistance !== undefined && query.combustibleDistance !== '') {
    const dist = parseNumber(query.combustibleDistance);
    if (dist === null) {
      errors.push('combustibleDistance 必须是有效的数字');
    } else if (dist < 0) {
      errors.push('combustibleDistance 不能为负数');
    } else {
      result.combustibleDistance = dist;
    }
  }

  if (query.ventilationDistance !== undefined && query.ventilationDistance !== '') {
    const dist = parseNumber(query.ventilationDistance);
    if (dist === null) {
      errors.push('ventilationDistance 必须是有效的数字');
    } else if (dist < 0) {
      errors.push('ventilationDistance 不能为负数');
    } else {
      result.ventilationDistance = dist;
    }
  }

  if (query.burningHours !== undefined && query.burningHours !== '') {
    const hours = parseNumber(query.burningHours);
    if (hours === null) {
      errors.push('burningHours 必须是有效的数字');
    } else if (hours < 0) {
      errors.push('burningHours 不能为负数');
    } else if (hours > 168) {
      errors.push('burningHours 不能超过168小时');
    } else {
      result.burningHours = hours;
    }
  }

  if (query.wickLength !== undefined && query.wickLength !== '') {
    const length = parseNumber(query.wickLength);
    if (length === null) {
      errors.push('wickLength 必须是有效的数字');
    } else if (length < 0) {
      errors.push('wickLength 不能为负数');
    } else {
      result.wickLength = length;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data: result
  };
}

const VALID_RELATIONSHIP_TYPES = ['lover', 'family', 'friend', 'colleague', 'teacher', 'client'];
const VALID_AGE_GROUPS = ['child', 'teen', 'young_adult', 'adult', 'middle_aged', 'senior'];
const VALID_GIFT_OCCASIONS = ['birthday', 'anniversary', 'valentines', 'mothers_day', 'fathers_day', 'christmas', 'new_year', 'spring_festival', 'mid_autumn', 'teachers_day', 'graduation', 'housewarming', 'wedding', 'baby_shower', 'thank_you', 'get_well', 'just_because'];
const VALID_PACKAGING_PREFERENCES = ['simple', 'gift', 'luxury', 'festive', 'eco'];
const VALID_SUBSCRIPTION_CYCLES = ['monthly', 'bimonthly', 'quarterly', 'biannual', 'annual'];
const VALID_GIFT_BOX_THEMES = ['romance', 'warmth', 'friendship', 'elegant', 'gratitude', 'premium', 'birthday', 'festival', 'relax', 'fresh'];

function validateAgeGroup(ageGroup, required = false) {
  if (!required && (ageGroup === undefined || ageGroup === null)) {
    return { valid: true, data: undefined };
  }
  if (!VALID_AGE_GROUPS.includes(ageGroup)) {
    return { valid: false, errors: [`年龄段必须是以下值之一: ${VALID_AGE_GROUPS.join(', ')}`] };
  }
  return { valid: true, data: ageGroup };
}

function validateRelationshipType(relationship, required = true) {
  if (!required && (relationship === undefined || relationship === null)) {
    return { valid: true, data: undefined };
  }
  if (!VALID_RELATIONSHIP_TYPES.includes(relationship)) {
    return { valid: false, errors: [`关系类型必须是以下值之一: ${VALID_RELATIONSHIP_TYPES.join(', ')}`], validTypes: VALID_RELATIONSHIP_TYPES };
  }
  return { valid: true, data: relationship };
}

function validateGiftOccasion(occasion, required = false) {
  if (!required && (occasion === undefined || occasion === null)) {
    return { valid: true, data: undefined };
  }
  if (!VALID_GIFT_OCCASIONS.includes(occasion)) {
    return { valid: false, errors: [`送礼场景必须是以下值之一: ${VALID_GIFT_OCCASIONS.join(', ')}`] };
  }
  return { valid: true, data: occasion };
}

function validatePackagingPreference(packaging, required = false) {
  if (!required && (packaging === undefined || packaging === null)) {
    return { valid: true, data: undefined };
  }
  if (!VALID_PACKAGING_PREFERENCES.includes(packaging)) {
    return { valid: false, errors: [`包装偏好必须是以下值之一: ${VALID_PACKAGING_PREFERENCES.join(', ')}`] };
  }
  return { valid: true, data: packaging };
}

function validateSubscriptionCycle(cycle, required = false) {
  if (!required && (cycle === undefined || cycle === null)) {
    return { valid: true, data: undefined };
  }
  if (!VALID_SUBSCRIPTION_CYCLES.includes(cycle)) {
    return { valid: false, errors: [`订阅周期必须是以下值之一: ${VALID_SUBSCRIPTION_CYCLES.join(', ')}`] };
  }
  return { valid: true, data: cycle };
}

function validateGiftBoxTheme(theme, required = false) {
  if (!required && (theme === undefined || theme === null)) {
    return { valid: true, data: undefined };
  }
  if (!VALID_GIFT_BOX_THEMES.includes(theme)) {
    return { valid: false, errors: [`礼盒主题必须是以下值之一: ${VALID_GIFT_BOX_THEMES.join(', ')}`] };
  }
  return { valid: true, data: theme };
}

function validateBudget(minBudget, maxBudget, required = true) {
  const errors = [];
  const result = {};

  if (required && (minBudget === undefined || minBudget === null) && (maxBudget === undefined || maxBudget === null)) {
    errors.push('预算 minBudget 或 maxBudget 至少提供一个');
    return { valid: false, errors };
  }

  if (minBudget !== undefined && minBudget !== null) {
    const min = parsePositiveNumber(minBudget);
    if (min === null || min < 0) {
      errors.push('minBudget 必须是有效的非负数');
    } else {
      result.minBudget = min;
    }
  }

  if (maxBudget !== undefined && maxBudget !== null) {
    const max = parsePositiveNumber(maxBudget);
    if (max === null || max <= 0) {
      errors.push('maxBudget 必须是有效的正数');
    } else {
      result.maxBudget = max;
    }
  }

  if (result.minBudget !== undefined && result.maxBudget !== undefined) {
    if (result.minBudget > result.maxBudget) {
      errors.push('minBudget 不能大于 maxBudget');
    }
  }

  if (result.maxBudget !== undefined && result.maxBudget < 50) {
    errors.push('maxBudget 不能低于最低预算 50 元');
  }

  if (result.minBudget !== undefined && result.minBudget > 2000) {
    errors.push('minBudget 不能超过最高预算 2000 元');
  }

  return {
    valid: errors.length === 0,
    errors,
    data: result
  };
}

function validateDate(dateStr, fieldName, required = false) {
  if (!required && (dateStr === undefined || dateStr === null)) {
    return { valid: true, data: undefined };
  }
  if (typeof dateStr !== 'string' || dateStr.trim() === '') {
    return { valid: false, errors: [`${fieldName} 必须是非空字符串`] };
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return { valid: false, errors: [`${fieldName} 必须是有效的日期格式 (YYYY-MM-DD)`] };
  }
  return { valid: true, data: date.toISOString().split('T')[0] };
}

function validateForbiddenTags(tags, fieldName = 'forbiddenTags') {
  if (tags === undefined || tags === null) {
    return { valid: true, data: [] };
  }
  return validateStringArray(tags, fieldName, 32, false);
}

function validateRecipientProfile(body) {
  const errors = [];
  const result = {};

  if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
    errors.push('name 不能为空且必须是字符串');
  } else {
    const trimmed = body.name.trim();
    if (trimmed.length > 64) {
      errors.push('name 长度不能超过64个字符');
    }
    result.name = trimmed;
  }

  if (body.gender !== undefined && body.gender !== null) {
    if (!['male', 'female', 'other'].includes(body.gender)) {
      errors.push('gender 必须是 male、female 或 other');
    } else {
      result.gender = body.gender;
    }
  }

  const ageGroupValidation = validateAgeGroup(body.ageGroup, true);
  if (!ageGroupValidation.valid) {
    errors.push(...ageGroupValidation.errors);
  } else {
    result.ageGroup = ageGroupValidation.data;
  }

  const relationshipValidation = validateRelationshipType(body.relationship, true);
  if (!relationshipValidation.valid) {
    errors.push(...relationshipValidation.errors);
  } else {
    result.relationship = relationshipValidation.data;
  }

  if (body.preferredScents !== undefined) {
    const scentsValidation = validateStringArray(body.preferredScents, 'preferredScents', 32, false);
    if (!scentsValidation.valid) {
      errors.push(...scentsValidation.errors);
    } else if (scentsValidation.data !== undefined) {
      result.preferredScents = scentsValidation.data;
    }
  }

  const allergyValidation = validateForbiddenTags(body.allergyTags, 'allergyTags');
  if (!allergyValidation.valid) {
    errors.push(...allergyValidation.errors);
  } else if (allergyValidation.data !== undefined) {
    result.allergyTags = allergyValidation.data;
  }

  const excludeValidation = validateForbiddenTags(body.excludeTags, 'excludeTags');
  if (!excludeValidation.valid) {
    errors.push(...excludeValidation.errors);
  } else if (excludeValidation.data !== undefined) {
    result.excludeTags = excludeValidation.data;
  }

  if (result.allergyTags && result.excludeTags) {
    const overlap = result.allergyTags.filter(t => result.excludeTags.includes(t));
    if (overlap.length > 0) {
      errors.push(`过敏标签与排斥标签存在重复: ${overlap.join(', ')}`);
    }
  }

  if (body.giftOccasions !== undefined) {
    const occasions = Array.isArray(body.giftOccasions) ? body.giftOccasions : [body.giftOccasions];
    const validatedOccasions = [];
    for (let i = 0; i < occasions.length; i++) {
      const occValidation = validateGiftOccasion(occasions[i], false);
      if (!occValidation.valid) {
        errors.push(`giftOccasions[${i}]: ${occValidation.errors[0]}`);
      } else if (occValidation.data !== undefined) {
        validatedOccasions.push(occValidation.data);
      }
    }
    if (validatedOccasions.length > 0) {
      result.giftOccasions = [...new Set(validatedOccasions)];
    }
  }

  const budgetValidation = validateBudget(body.minBudget, body.maxBudget, false);
  if (!budgetValidation.valid) {
    errors.push(...budgetValidation.errors);
  } else {
    if (budgetValidation.data.minBudget !== undefined) result.minBudget = budgetValidation.data.minBudget;
    if (budgetValidation.data.maxBudget !== undefined) result.maxBudget = budgetValidation.data.maxBudget;
  }

  const deliveryDateValidation = validateDate(body.expectedDeliveryDate, 'expectedDeliveryDate', false);
  if (!deliveryDateValidation.valid) {
    errors.push(...deliveryDateValidation.errors);
  } else if (deliveryDateValidation.data !== undefined) {
    result.expectedDeliveryDate = deliveryDateValidation.data;
  }

  const packagingValidation = validatePackagingPreference(body.packagingPreference, false);
  if (!packagingValidation.valid) {
    errors.push(...packagingValidation.errors);
  } else if (packagingValidation.data !== undefined) {
    result.packagingPreference = packagingValidation.data;
  }

  const themeValidation = validateGiftBoxTheme(body.preferredTheme, false);
  if (!themeValidation.valid) {
    errors.push(...themeValidation.errors);
  } else if (themeValidation.data !== undefined) {
    result.preferredTheme = themeValidation.data;
  }

  if (body.intensityPreference !== undefined) {
    const intensityValidation = validateIntensity(body.intensityPreference);
    if (!intensityValidation.valid) {
      errors.push(...intensityValidation.errors);
    } else {
      result.intensityPreference = intensityValidation.data;
    }
  }

  if (body.notes !== undefined) {
    if (typeof body.notes !== 'string') {
      errors.push('notes 必须是字符串');
    } else if (body.notes.length > 500) {
      errors.push('notes 长度不能超过500个字符');
    } else {
      result.notes = body.notes.trim();
    }
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

function validateGiftBoxRecommendationQuery(body) {
  const errors = [];
  const result = {};

  if (body.recipientProfileId !== undefined && body.recipientProfileId !== null) {
    const profileId = parseStrictPositiveInteger(body.recipientProfileId);
    if (profileId === null) {
      errors.push('recipientProfileId 必须是有效的正整数');
    } else {
      result.recipientProfileId = profileId;
    }
  }

  if (!result.recipientProfileId) {
    if (!body.relationship && !body.ageGroup && !body.preferredScents) {
      errors.push('必须提供 recipientProfileId，或至少提供 relationship、ageGroup、preferredScents 中的一项');
    }
  }

  const relationshipValidation = validateRelationshipType(body.relationship, false);
  if (!relationshipValidation.valid) {
    errors.push(...relationshipValidation.errors);
  } else if (relationshipValidation.data !== undefined) {
    result.relationship = relationshipValidation.data;
  }

  const ageGroupValidation = validateAgeGroup(body.ageGroup, false);
  if (!ageGroupValidation.valid) {
    errors.push(...ageGroupValidation.errors);
  } else if (ageGroupValidation.data !== undefined) {
    result.ageGroup = ageGroupValidation.data;
  }

  if (body.preferredScents !== undefined) {
    const scentsValidation = validateStringArray(body.preferredScents, 'preferredScents', 32, false);
    if (!scentsValidation.valid) {
      errors.push(...scentsValidation.errors);
    } else if (scentsValidation.data !== undefined) {
      result.preferredScents = scentsValidation.data;
    }
  }

  const allergyValidation = validateForbiddenTags(body.allergyTags, 'allergyTags');
  if (!allergyValidation.valid) {
    errors.push(...allergyValidation.errors);
  } else if (allergyValidation.data !== undefined) {
    result.allergyTags = allergyValidation.data;
  }

  const excludeValidation = validateForbiddenTags(body.excludeTags, 'excludeTags');
  if (!excludeValidation.valid) {
    errors.push(...excludeValidation.errors);
  } else if (excludeValidation.data !== undefined) {
    result.excludeTags = excludeValidation.data;
  }

  if (result.allergyTags && result.excludeTags) {
    const overlap = result.allergyTags.filter(t => result.excludeTags.includes(t));
    if (overlap.length > 0) {
      errors.push(`过敏标签与排斥标签存在重复: ${overlap.join(', ')}`);
    }
  }

  const occasionValidation = validateGiftOccasion(body.occasion, false);
  if (!occasionValidation.valid) {
    errors.push(...occasionValidation.errors);
  } else if (occasionValidation.data !== undefined) {
    result.occasion = occasionValidation.data;
  }

  const budgetValidation = validateBudget(body.minBudget, body.maxBudget, false);
  if (!budgetValidation.valid) {
    errors.push(...budgetValidation.errors);
  } else {
    if (budgetValidation.data.minBudget !== undefined) result.minBudget = budgetValidation.data.minBudget;
    if (budgetValidation.data.maxBudget !== undefined) result.maxBudget = budgetValidation.data.maxBudget;
  }

  const themeValidation = validateGiftBoxTheme(body.theme, false);
  if (!themeValidation.valid) {
    errors.push(...themeValidation.errors);
  } else if (themeValidation.data !== undefined) {
    result.theme = themeValidation.data;
  }

  const seasonValidation = validateSeasonCode(body.season);
  if (!seasonValidation.valid && body.season !== undefined && body.season !== null) {
    errors.push(...seasonValidation.errors);
  } else if (seasonValidation.data !== undefined) {
    result.season = seasonValidation.data;
  }

  const packagingValidation = validatePackagingPreference(body.packagingPreference, false);
  if (!packagingValidation.valid) {
    errors.push(...packagingValidation.errors);
  } else if (packagingValidation.data !== undefined) {
    result.packagingPreference = packagingValidation.data;
  }

  if (body.maxCandles !== undefined && body.maxCandles !== null) {
    const max = parseStrictPositiveInteger(body.maxCandles);
    if (max === null || max < 1 || max > 10) {
      errors.push('maxCandles 必须是1-10之间的正整数');
    } else {
      result.maxCandles = max;
    }
  }

  const deliveryDateValidation = validateDate(body.expectedDeliveryDate, 'expectedDeliveryDate', false);
  if (!deliveryDateValidation.valid) {
    errors.push(...deliveryDateValidation.errors);
  } else if (deliveryDateValidation.data !== undefined) {
    result.expectedDeliveryDate = deliveryDateValidation.data;
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

function validateSubscriptionPlanQuery(body) {
  const errors = [];
  const result = {};

  if (body.recipientProfileId === undefined || body.recipientProfileId === null) {
    errors.push('recipientProfileId 为必填项');
  } else {
    const profileId = parseStrictPositiveInteger(body.recipientProfileId);
    if (profileId === null) {
      errors.push('recipientProfileId 必须是有效的正整数');
    } else {
      result.recipientProfileId = profileId;
    }
  }

  const cycleValidation = validateSubscriptionCycle(body.cycle, true);
  if (!cycleValidation.valid) {
    errors.push(...cycleValidation.errors);
  } else {
    result.cycle = cycleValidation.data;
  }

  const budgetValidation = validateBudget(body.minBudget, body.maxBudget, false);
  if (!budgetValidation.valid) {
    errors.push(...budgetValidation.errors);
  } else {
    if (budgetValidation.data.minBudget !== undefined) result.minBudget = budgetValidation.data.minBudget;
    if (budgetValidation.data.maxBudget !== undefined) result.maxBudget = budgetValidation.data.maxBudget;
  }

  const themeValidation = validateGiftBoxTheme(body.preferredTheme, false);
  if (!themeValidation.valid) {
    errors.push(...themeValidation.errors);
  } else if (themeValidation.data !== undefined) {
    result.preferredTheme = themeValidation.data;
  }

  const packagingValidation = validatePackagingPreference(body.packagingPreference, false);
  if (!packagingValidation.valid) {
    errors.push(...packagingValidation.errors);
  } else if (packagingValidation.data !== undefined) {
    result.packagingPreference = packagingValidation.data;
  }

  if (body.startDate !== undefined) {
    const startDateValidation = validateDate(body.startDate, 'startDate', false);
    if (!startDateValidation.valid) {
      errors.push(...startDateValidation.errors);
    } else if (startDateValidation.data !== undefined) {
      result.startDate = startDateValidation.data;
    }
  }

  if (body.months !== undefined && body.months !== null) {
    const months = parseStrictPositiveInteger(body.months);
    if (months === null || months < 1 || months > 24) {
      errors.push('months 必须是1-24之间的正整数');
    } else {
      result.months = months;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data: result
  };
}

function validateBudgetCombinationQuery(body) {
  const errors = [];
  const result = {};

  const budgetValidation = validateBudget(body.minBudget, body.maxBudget, true);
  if (!budgetValidation.valid) {
    errors.push(...budgetValidation.errors);
  } else {
    if (budgetValidation.data.minBudget !== undefined) result.minBudget = budgetValidation.data.minBudget;
    if (budgetValidation.data.maxBudget !== undefined) result.maxBudget = budgetValidation.data.maxBudget;
  }

  if (body.recipientProfileId !== undefined && body.recipientProfileId !== null) {
    const profileId = parseStrictPositiveInteger(body.recipientProfileId);
    if (profileId === null) {
      errors.push('recipientProfileId 必须是有效的正整数');
    } else {
      result.recipientProfileId = profileId;
    }
  }

  const relationshipValidation = validateRelationshipType(body.relationship, false);
  if (!relationshipValidation.valid) {
    errors.push(...relationshipValidation.errors);
  } else if (relationshipValidation.data !== undefined) {
    result.relationship = relationshipValidation.data;
  }

  if (body.preferredScents !== undefined) {
    const scentsValidation = validateStringArray(body.preferredScents, 'preferredScents', 32, false);
    if (!scentsValidation.valid) {
      errors.push(...scentsValidation.errors);
    } else if (scentsValidation.data !== undefined) {
      result.preferredScents = scentsValidation.data;
    }
  }

  const allergyValidation = validateForbiddenTags(body.allergyTags, 'allergyTags');
  if (!allergyValidation.valid) {
    errors.push(...allergyValidation.errors);
  } else if (allergyValidation.data !== undefined) {
    result.allergyTags = allergyValidation.data;
  }

  const excludeValidation = validateForbiddenTags(body.excludeTags, 'excludeTags');
  if (!excludeValidation.valid) {
    errors.push(...excludeValidation.errors);
  } else if (excludeValidation.data !== undefined) {
    result.excludeTags = excludeValidation.data;
  }

  if (body.maxCombinations !== undefined && body.maxCombinations !== null) {
    const max = parseStrictPositiveInteger(body.maxCombinations);
    if (max === null || max < 1 || max > 20) {
      errors.push('maxCombinations 必须是1-20之间的正整数');
    } else {
      result.maxCombinations = max;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data: result
  };
}

function validateStockAlternativeQuery(body) {
  const errors = [];
  const result = {};

  if (!body.candleIds || !Array.isArray(body.candleIds) || body.candleIds.length === 0) {
    errors.push('candleIds 为必填项且必须是非空数组');
  } else {
    const validatedIds = [];
    for (let i = 0; i < body.candleIds.length; i++) {
      const id = parseStrictPositiveInteger(body.candleIds[i]);
      if (id === null) {
        errors.push(`candleIds[${i}] 必须是有效的正整数`);
      } else {
        validatedIds.push(id);
      }
    }
    if (validatedIds.length > 0) {
      result.candleIds = [...new Set(validatedIds)];
    }
  }

  if (body.recipientProfileId !== undefined && body.recipientProfileId !== null) {
    const profileId = parseStrictPositiveInteger(body.recipientProfileId);
    if (profileId === null) {
      errors.push('recipientProfileId 必须是有效的正整数');
    } else {
      result.recipientProfileId = profileId;
    }
  }

  const relationshipValidation = validateRelationshipType(body.relationship, false);
  if (!relationshipValidation.valid) {
    errors.push(...relationshipValidation.errors);
  } else if (relationshipValidation.data !== undefined) {
    result.relationship = relationshipValidation.data;
  }

  if (body.preferredScents !== undefined) {
    const scentsValidation = validateStringArray(body.preferredScents, 'preferredScents', 32, false);
    if (!scentsValidation.valid) {
      errors.push(...scentsValidation.errors);
    } else if (scentsValidation.data !== undefined) {
      result.preferredScents = scentsValidation.data;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data: result
  };
}

function validateGiftMessageQuery(body) {
  const errors = [];
  const result = {};

  if (body.recipientProfileId === undefined || body.recipientProfileId === null) {
    errors.push('recipientProfileId 为必填项');
  } else {
    const profileId = parseStrictPositiveInteger(body.recipientProfileId);
    if (profileId === null) {
      errors.push('recipientProfileId 必须是有效的正整数');
    } else {
      result.recipientProfileId = profileId;
    }
  }

  const occasionValidation = validateGiftOccasion(body.occasion, true);
  if (!occasionValidation.valid) {
    errors.push(...occasionValidation.errors);
  } else {
    result.occasion = occasionValidation.data;
  }

  if (body.candleIds !== undefined) {
    if (!Array.isArray(body.candleIds)) {
      errors.push('candleIds 必须是数组');
    } else {
      const validatedIds = [];
      for (let i = 0; i < body.candleIds.length; i++) {
        const id = parseStrictPositiveInteger(body.candleIds[i]);
        if (id === null) {
          errors.push(`candleIds[${i}] 必须是有效的正整数`);
        } else {
          validatedIds.push(id);
        }
      }
      if (validatedIds.length > 0) {
        result.candleIds = validatedIds;
      }
    }
  }

  const themeValidation = validateGiftBoxTheme(body.theme, false);
  if (!themeValidation.valid) {
    errors.push(...themeValidation.errors);
  } else if (themeValidation.data !== undefined) {
    result.theme = themeValidation.data;
  }

  if (body.tone !== undefined) {
    if (!['warm', 'romantic', 'formal', 'casual', 'humorous', 'touching'].includes(body.tone)) {
      errors.push('tone 必须是 warm、romantic、formal、casual、humorous 或 touching');
    } else {
      result.tone = body.tone;
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
  validateWeather,
  validateSafetyInspection,
  validateBurningEvent,
  validateRiskAssessmentQuery,
  validateBoolean,
  validateEventType,
  validateInspectionType,
  validateDistance,
  validateWickLength,
  validateAgeGroup,
  validateRelationshipType,
  validateGiftOccasion,
  validatePackagingPreference,
  validateSubscriptionCycle,
  validateGiftBoxTheme,
  validateBudget,
  validateDate,
  validateForbiddenTags,
  validateRecipientProfile,
  validateGiftBoxRecommendationQuery,
  validateSubscriptionPlanQuery,
  validateBudgetCombinationQuery,
  validateStockAlternativeQuery,
  validateGiftMessageQuery,
  VALID_RELATIONSHIP_TYPES,
  VALID_AGE_GROUPS,
  VALID_GIFT_OCCASIONS,
  VALID_PACKAGING_PREFERENCES,
  VALID_SUBSCRIPTION_CYCLES,
  VALID_GIFT_BOX_THEMES
};
