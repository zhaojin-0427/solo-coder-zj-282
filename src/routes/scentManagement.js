const express = require('express');
const router = express.Router();
const { storage } = require('../storage/memoryStorage');
const { success, error } = require('../utils/response');
const {
  validateScentTag,
  validateFragranceCategory,
  validateUsageScenario,
  validateMoodGoal,
  validateSeasonPreference,
  parseStrictPositiveInteger
} = require('../utils/validator');

router.get('/scent-tags', (req, res) => {
  try {
    const { name, category } = req.query;
    const filters = {};
    if (name) filters.name = name;
    if (category) filters.category = category;

    const tags = storage.getScentTags(filters);
    res.json(success({ tags, count: tags.length }));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.post('/scent-tags', (req, res) => {
  try {
    const validation = validateScentTag(req.body);
    if (!validation.valid) {
      return res.json(error(400, '参数校验失败', validation.errors));
    }

    const existing = storage.getScentTags({ name: validation.data.name });
    if (existing.length > 0) {
      return res.json(error(400, '该气味标签已存在'));
    }

    const tag = storage.addScentTag(validation.data);
    res.json(success(tag, '气味标签创建成功'));
  } catch (err) {
    res.json(error(400, err.message));
  }
});

router.get('/scent-tags/:id', (req, res) => {
  try {
    const id = parseStrictPositiveInteger(req.params.id);
    if (id === null) {
      return res.json(error(400, 'id 必须是有效的正整数'));
    }

    const tag = storage.getScentTagById(id);
    if (!tag) {
      return res.json(error(404, '未找到该气味标签'));
    }
    res.json(success(tag));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.put('/scent-tags/:id', (req, res) => {
  try {
    const id = parseStrictPositiveInteger(req.params.id);
    if (id === null) {
      return res.json(error(400, 'id 必须是有效的正整数'));
    }

    const existing = storage.getScentTagById(id);
    if (!existing) {
      return res.json(error(404, '未找到该气味标签'));
    }

    const validation = validateScentTag(req.body);
    if (!validation.valid) {
      return res.json(error(400, '参数校验失败', validation.errors));
    }

    const updated = storage.updateScentTag(id, validation.data);
    res.json(success(updated, '气味标签更新成功'));
  } catch (err) {
    res.json(error(400, err.message));
  }
});

router.delete('/scent-tags/:id', (req, res) => {
  try {
    const id = parseStrictPositiveInteger(req.params.id);
    if (id === null) {
      return res.json(error(400, 'id 必须是有效的正整数'));
    }

    const deleted = storage.deleteScentTag(id);
    if (!deleted) {
      return res.json(error(404, '未找到该气味标签'));
    }
    res.json(success(deleted, '气味标签删除成功'));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/fragrance-categories', (req, res) => {
  try {
    const { code, name } = req.query;
    const filters = {};
    if (code) filters.code = code;
    if (name) filters.name = name;

    const categories = storage.getFragranceCategories(filters);
    res.json(success({ categories, count: categories.length }));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.post('/fragrance-categories', (req, res) => {
  try {
    const validation = validateFragranceCategory(req.body);
    if (!validation.valid) {
      return res.json(error(400, '参数校验失败', validation.errors));
    }

    const existing = storage.getFragranceCategoryByCode(validation.data.code);
    if (existing) {
      return res.json(error(400, '该香调分类编码已存在'));
    }

    const category = storage.addFragranceCategory(validation.data);
    res.json(success(category, '香调分类创建成功'));
  } catch (err) {
    res.json(error(400, err.message));
  }
});

router.get('/fragrance-categories/:id', (req, res) => {
  try {
    const id = parseStrictPositiveInteger(req.params.id);
    if (id === null) {
      return res.json(error(400, 'id 必须是有效的正整数'));
    }

    const category = storage.getFragranceCategoryById(id);
    if (!category) {
      return res.json(error(404, '未找到该香调分类'));
    }
    res.json(success(category));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.put('/fragrance-categories/:id', (req, res) => {
  try {
    const id = parseStrictPositiveInteger(req.params.id);
    if (id === null) {
      return res.json(error(400, 'id 必须是有效的正整数'));
    }

    const existing = storage.getFragranceCategoryById(id);
    if (!existing) {
      return res.json(error(404, '未找到该香调分类'));
    }

    const validation = validateFragranceCategory(req.body);
    if (!validation.valid) {
      return res.json(error(400, '参数校验失败', validation.errors));
    }

    const updated = storage.updateFragranceCategory(id, validation.data);
    res.json(success(updated, '香调分类更新成功'));
  } catch (err) {
    res.json(error(400, err.message));
  }
});

router.delete('/fragrance-categories/:id', (req, res) => {
  try {
    const id = parseStrictPositiveInteger(req.params.id);
    if (id === null) {
      return res.json(error(400, 'id 必须是有效的正整数'));
    }

    const deleted = storage.deleteFragranceCategory(id);
    if (!deleted) {
      return res.json(error(404, '未找到该香调分类'));
    }
    res.json(success(deleted, '香调分类删除成功'));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/usage-scenarios', (req, res) => {
  try {
    const { code, name } = req.query;
    const filters = {};
    if (code) filters.code = code;
    if (name) filters.name = name;

    const scenarios = storage.getUsageScenarios(filters);
    res.json(success({ scenarios, count: scenarios.length }));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.post('/usage-scenarios', (req, res) => {
  try {
    const validation = validateUsageScenario(req.body);
    if (!validation.valid) {
      return res.json(error(400, '参数校验失败', validation.errors));
    }

    const existing = storage.getUsageScenarioByCode(validation.data.code);
    if (existing) {
      return res.json(error(400, '该使用场景编码已存在'));
    }

    const scenario = storage.addUsageScenario(validation.data);
    res.json(success(scenario, '使用场景创建成功'));
  } catch (err) {
    res.json(error(400, err.message));
  }
});

router.get('/usage-scenarios/:id', (req, res) => {
  try {
    const id = parseStrictPositiveInteger(req.params.id);
    if (id === null) {
      return res.json(error(400, 'id 必须是有效的正整数'));
    }

    const scenario = storage.getUsageScenarioById(id);
    if (!scenario) {
      return res.json(error(404, '未找到该使用场景'));
    }
    res.json(success(scenario));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.put('/usage-scenarios/:id', (req, res) => {
  try {
    const id = parseStrictPositiveInteger(req.params.id);
    if (id === null) {
      return res.json(error(400, 'id 必须是有效的正整数'));
    }

    const existing = storage.getUsageScenarioById(id);
    if (!existing) {
      return res.json(error(404, '未找到该使用场景'));
    }

    const validation = validateUsageScenario(req.body);
    if (!validation.valid) {
      return res.json(error(400, '参数校验失败', validation.errors));
    }

    const updated = storage.updateUsageScenario(id, validation.data);
    res.json(success(updated, '使用场景更新成功'));
  } catch (err) {
    res.json(error(400, err.message));
  }
});

router.delete('/usage-scenarios/:id', (req, res) => {
  try {
    const id = parseStrictPositiveInteger(req.params.id);
    if (id === null) {
      return res.json(error(400, 'id 必须是有效的正整数'));
    }

    const deleted = storage.deleteUsageScenario(id);
    if (!deleted) {
      return res.json(error(404, '未找到该使用场景'));
    }
    res.json(success(deleted, '使用场景删除成功'));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/mood-goals', (req, res) => {
  try {
    const { code, name } = req.query;
    const filters = {};
    if (code) filters.code = code;
    if (name) filters.name = name;

    const moods = storage.getMoodGoals(filters);
    res.json(success({ moods, count: moods.length }));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.post('/mood-goals', (req, res) => {
  try {
    const validation = validateMoodGoal(req.body);
    if (!validation.valid) {
      return res.json(error(400, '参数校验失败', validation.errors));
    }

    const existing = storage.getMoodGoalByCode(validation.data.code);
    if (existing) {
      return res.json(error(400, '该情绪目标编码已存在'));
    }

    const mood = storage.addMoodGoal(validation.data);
    res.json(success(mood, '情绪目标创建成功'));
  } catch (err) {
    res.json(error(400, err.message));
  }
});

router.get('/mood-goals/:id', (req, res) => {
  try {
    const id = parseStrictPositiveInteger(req.params.id);
    if (id === null) {
      return res.json(error(400, 'id 必须是有效的正整数'));
    }

    const mood = storage.getMoodGoalById(id);
    if (!mood) {
      return res.json(error(404, '未找到该情绪目标'));
    }
    res.json(success(mood));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.put('/mood-goals/:id', (req, res) => {
  try {
    const id = parseStrictPositiveInteger(req.params.id);
    if (id === null) {
      return res.json(error(400, 'id 必须是有效的正整数'));
    }

    const existing = storage.getMoodGoalById(id);
    if (!existing) {
      return res.json(error(404, '未找到该情绪目标'));
    }

    const validation = validateMoodGoal(req.body);
    if (!validation.valid) {
      return res.json(error(400, '参数校验失败', validation.errors));
    }

    const updated = storage.updateMoodGoal(id, validation.data);
    res.json(success(updated, '情绪目标更新成功'));
  } catch (err) {
    res.json(error(400, err.message));
  }
});

router.delete('/mood-goals/:id', (req, res) => {
  try {
    const id = parseStrictPositiveInteger(req.params.id);
    if (id === null) {
      return res.json(error(400, 'id 必须是有效的正整数'));
    }

    const deleted = storage.deleteMoodGoal(id);
    if (!deleted) {
      return res.json(error(404, '未找到该情绪目标'));
    }
    res.json(success(deleted, '情绪目标删除成功'));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/season-preferences', (req, res) => {
  try {
    const { code, name } = req.query;
    const filters = {};
    if (code) filters.code = code;
    if (name) filters.name = name;

    const seasons = storage.getSeasonPreferences(filters);
    res.json(success({ seasons, count: seasons.length }));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.post('/season-preferences', (req, res) => {
  try {
    const validation = validateSeasonPreference(req.body);
    if (!validation.valid) {
      return res.json(error(400, '参数校验失败', validation.errors));
    }

    const existing = storage.getSeasonPreferenceByCode(validation.data.code);
    if (existing) {
      return res.json(error(400, '该季节偏好编码已存在'));
    }

    const season = storage.addSeasonPreference(validation.data);
    res.json(success(season, '季节偏好创建成功'));
  } catch (err) {
    res.json(error(400, err.message));
  }
});

router.get('/season-preferences/:id', (req, res) => {
  try {
    const id = parseStrictPositiveInteger(req.params.id);
    if (id === null) {
      return res.json(error(400, 'id 必须是有效的正整数'));
    }

    const season = storage.getSeasonPreferenceById(id);
    if (!season) {
      return res.json(error(404, '未找到该季节偏好'));
    }
    res.json(success(season));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.put('/season-preferences/:id', (req, res) => {
  try {
    const id = parseStrictPositiveInteger(req.params.id);
    if (id === null) {
      return res.json(error(400, 'id 必须是有效的正整数'));
    }

    const existing = storage.getSeasonPreferenceById(id);
    if (!existing) {
      return res.json(error(404, '未找到该季节偏好'));
    }

    const validation = validateSeasonPreference(req.body);
    if (!validation.valid) {
      return res.json(error(400, '参数校验失败', validation.errors));
    }

    const updated = storage.updateSeasonPreference(id, validation.data);
    res.json(success(updated, '季节偏好更新成功'));
  } catch (err) {
    res.json(error(400, err.message));
  }
});

router.delete('/season-preferences/:id', (req, res) => {
  try {
    const id = parseStrictPositiveInteger(req.params.id);
    if (id === null) {
      return res.json(error(400, 'id 必须是有效的正整数'));
    }

    const deleted = storage.deleteSeasonPreference(id);
    if (!deleted) {
      return res.json(error(404, '未找到该季节偏好'));
    }
    res.json(success(deleted, '季节偏好删除成功'));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

router.get('/conflict-rules', (req, res) => {
  try {
    const rules = storage.getAllConflictRules();
    res.json(success({ rules, count: rules.length }));
  } catch (err) {
    res.json(error(500, '服务器错误', err.message));
  }
});

module.exports = router;
