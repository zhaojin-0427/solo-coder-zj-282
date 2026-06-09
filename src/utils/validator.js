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

function isValidPositiveNumber(value) {
  return parsePositiveNumber(value) !== null;
}

function normalizeCapacity(capacity) {
  return parseInteger(capacity);
}

function normalizeQuantity(quantity) {
  return parsePositiveInteger(quantity);
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
  if (capacity === null) {
    errors.push('capacity 必须是有效的正整数');
  } else {
    result.capacity = capacity;
  }

  const quantity = normalizeQuantity(body.quantity);
  if (quantity === null) {
    errors.push('quantity 必须是有效的非负整数');
  } else {
    result.quantity = quantity;
  }

  if (body.actualBurned !== undefined) {
    const actualBurned = parsePositiveNumber(body.actualBurned);
    if (actualBurned === null) {
      errors.push('actualBurned 必须是有效的非负数');
    } else {
      result.actualBurned = actualBurned;
    }
  }

  if (body.burnHours !== undefined) {
    const burnHours = parsePositiveNumber(body.burnHours);
    if (burnHours === null || burnHours <= 0) {
      errors.push('burnHours 必须是有效的正数');
    } else {
      result.burnHours = burnHours;
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
  parsePositiveNumber,
  isValidNumber,
  isValidPositiveInteger,
  isValidPositiveNumber,
  normalizeCapacity,
  normalizeQuantity,
  validateInventoryReport
};
