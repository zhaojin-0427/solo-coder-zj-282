const express = require('express');
const { responseWrapper, notFoundHandler, errorHandler } = require('./middleware/responseWrapper');

const inventoryRoutes = require('./routes/inventory');
const consumptionRoutes = require('./routes/consumption');
const replenishmentRoutes = require('./routes/replenishment');
const tipsRoutes = require('./routes/tips');
const multiUserRoutes = require('./routes/multiUser');
const scentManagementRoutes = require('./routes/scentManagement');
const userScentPreferencesRoutes = require('./routes/userScentPreferences');
const recommendationsRoutes = require('./routes/recommendations');
const giftBoxRoutes = require('./routes/giftBox');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(responseWrapper);

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    const { error } = require('./utils/response');
    return res.status(400).json(error(400, 'JSON 格式错误，请检查请求体'));
  }
  next(err);
});

app.get('/', (req, res) => {
  const { success } = require('./utils/response');
  res.json(success({
    name: '香薰蜡烛燃烧时长预测与补货建议 API 服务',
    version: '5.0.0',
    description: '支持多用户使用画像与批次化补货计划，新增香薰气味偏好与场景化搭配推荐能力，新增蜡烛燃烧安全风险评估与家庭场景告警能力，新增香薰蜡烛订阅礼盒与送礼人群匹配能力',
    endpoints: {
      singleUser: {
        inventory: {
          report: 'POST /api/inventory/report',
          list: 'GET /api/inventory'
        },
        consumption: {
          createModel: 'POST /api/consumption/model/:candleId',
          getModel: 'GET /api/consumption/model/:candleId',
          efficiency: 'GET /api/consumption/efficiency',
          listModels: 'GET /api/consumption/models'
        },
        replenishment: {
          advice: 'GET /api/replenishment/advice',
          prediction: 'GET /api/replenishment/prediction',
          alerts: 'GET /api/replenishment/alerts'
        },
        tips: {
          personalized: 'GET /api/tips/personalized/:candleId',
          byType: 'GET /api/tips/type/:type',
          list: 'GET /api/tips'
        },
        scentManagement: {
          scentTags: 'GET/POST /api/scent/scent-tags',
          scentTagById: 'GET/PUT/DELETE /api/scent/scent-tags/:id',
          fragranceCategories: 'GET/POST /api/scent/fragrance-categories',
          fragranceCategoryById: 'GET/PUT/DELETE /api/scent/fragrance-categories/:id',
          usageScenarios: 'GET/POST /api/scent/usage-scenarios',
          usageScenarioById: 'GET/PUT/DELETE /api/scent/usage-scenarios/:id',
          moodGoals: 'GET/POST /api/scent/mood-goals',
          moodGoalById: 'GET/PUT/DELETE /api/scent/mood-goals/:id',
          seasonPreferences: 'GET/POST /api/scent/season-preferences',
          seasonPreferenceById: 'GET/PUT/DELETE /api/scent/season-preferences/:id',
          conflictRules: 'GET /api/scent/conflict-rules'
        },
        userScentPreferences: {
          submitRating: 'POST /api/scent-user/rating',
          getRatings: 'GET /api/scent-user/ratings',
          savePreferences: 'POST /api/scent-user/preferences',
          getPreferences: 'GET /api/scent-user/preferences',
          getFragranceProfile: 'GET /api/scent-user/fragrance-profile'
        },
        recommendations: {
          getRecommendations: 'POST /api/recommendations',
          byRoom: 'GET /api/recommendations/by-room/:scene',
          byMood: 'GET /api/recommendations/by-mood/:mood',
          bySeason: 'GET /api/recommendations/by-season/:season',
          inventoryUsage: 'GET /api/recommendations/inventory-usage',
          purchaseSuggestions: 'GET /api/recommendations/purchase-suggestions'
        },
        giftBox: {
          createRecipient: 'POST /api/gift-box/recipient',
          listRecipients: 'GET /api/gift-box/recipients',
          getRecipient: 'GET /api/gift-box/recipient/:id',
          updateRecipient: 'PUT /api/gift-box/recipient/:id',
          deleteRecipient: 'DELETE /api/gift-box/recipient/:id',
          recommend: 'POST /api/gift-box/recommend',
          subscription: 'POST /api/gift-box/subscription',
          budgetCombinations: 'POST /api/gift-box/budget-combinations',
          stockAlternatives: 'POST /api/gift-box/stock-alternatives',
          giftMessage: 'POST /api/gift-box/gift-message',
          metaThemes: 'GET /api/gift-box/meta/themes',
          metaRelationships: 'GET /api/gift-box/meta/relationships',
          metaHolidays: 'GET /api/gift-box/meta/holidays',
          metaBudgets: 'GET /api/gift-box/meta/budgets',
          metaPackaging: 'GET /api/gift-box/meta/packaging',
          metaCycles: 'GET /api/gift-box/meta/cycles'
        }
      },
      multiUser: {
        description: '所有多用户接口必须携带 userId 参数（支持 query string 或 body）',
        inventory: {
          report: 'POST /api/user/inventory/report?userId=xxx',
          list: 'GET /api/user/inventory?userId=xxx'
        },
        burning: {
          report: 'POST /api/user/burning/record?userId=xxx',
          list: 'GET /api/user/burning/records?userId=xxx'
        },
        consumption: {
          createModel: 'POST /api/user/consumption/model/:candleId?userId=xxx',
          getModel: 'GET /api/user/consumption/model/:candleId?userId=xxx',
          listModels: 'GET /api/user/consumption/models?userId=xxx'
        },
        userProfile: {
          getProfile: 'GET /api/user/profile?userId=xxx',
          getPrediction: 'GET /api/user/prediction?userId=xxx&days=7|14|30',
          getReplenishment: 'GET /api/user/replenishment?userId=xxx&days=7|14|30'
        },
        tips: {
          personalized: 'GET /api/user/tips/personalized?userId=xxx'
        },
        scentPreferences: {
          submitRating: 'POST /api/user/scent/rating?userId=xxx',
          getRatings: 'GET /api/user/scent/ratings?userId=xxx',
          savePreferences: 'POST /api/user/scent/preferences?userId=xxx',
          getPreferences: 'GET /api/user/scent/preferences?userId=xxx',
          getFragranceProfile: 'GET /api/user/scent/fragrance-profile?userId=xxx'
        },
        recommendations: {
          getRecommendations: 'POST /api/user/scent/recommendations?userId=xxx',
          byRoom: 'GET /api/user/scent/recommendations/by-room/:scene?userId=xxx',
          byMood: 'GET /api/user/scent/recommendations/by-mood/:mood?userId=xxx',
          bySeason: 'GET /api/user/scent/recommendations/by-season/:season?userId=xxx',
          inventoryUsage: 'GET /api/user/scent/inventory-usage?userId=xxx',
          purchaseSuggestions: 'GET /api/user/scent/purchase-suggestions?userId=xxx'
        },
        safety: {
          submitInspection: 'POST /api/user/safety/inspection?userId=xxx',
          getInspections: 'GET /api/user/safety/inspections?userId=xxx',
          reportBurningEvent: 'POST /api/user/safety/burning-event?userId=xxx',
          getBurningEvents: 'GET /api/user/safety/burning-events?userId=xxx',
          getSafetyProfile: 'GET /api/user/safety/profile?userId=xxx',
          getRiskAssessment: 'GET /api/user/safety/risk-assessment?userId=xxx',
          getRoomAlert: 'GET /api/user/safety/room-alert/:roomCode?userId=xxx',
          getSuggestions: 'GET /api/user/safety/suggestions?userId=xxx',
          getAlerts: 'GET /api/user/safety/alerts?userId=xxx',
          acknowledgeAlert: 'POST /api/user/safety/alert/:alertId/acknowledge?userId=xxx',
          getActiveSession: 'GET /api/user/safety/active-session?userId=xxx',
          getRules: 'GET /api/user/safety/rules',
          getRiskLevels: 'GET /api/user/safety/risk-levels',
          getFactors: 'GET /api/user/safety/factors'
        },
        giftBox: {
          createRecipient: 'POST /api/user/gift-box/recipient?userId=xxx',
          listRecipients: 'GET /api/user/gift-box/recipients?userId=xxx',
          getRecipient: 'GET /api/user/gift-box/recipient/:id?userId=xxx',
          updateRecipient: 'PUT /api/user/gift-box/recipient/:id?userId=xxx',
          deleteRecipient: 'DELETE /api/user/gift-box/recipient/:id?userId=xxx',
          recommend: 'POST /api/user/gift-box/recommend?userId=xxx',
          subscription: 'POST /api/user/gift-box/subscription?userId=xxx',
          budgetCombinations: 'POST /api/user/gift-box/budget-combinations?userId=xxx',
          stockAlternatives: 'POST /api/user/gift-box/stock-alternatives?userId=xxx',
          giftMessage: 'POST /api/user/gift-box/gift-message?userId=xxx',
          metaThemes: 'GET /api/user/gift-box/meta/themes',
          metaRelationships: 'GET /api/user/gift-box/meta/relationships',
          metaHolidays: 'GET /api/user/gift-box/meta/holidays',
          metaBudgets: 'GET /api/user/gift-box/meta/budgets',
          metaPackaging: 'GET /api/user/gift-box/meta/packaging',
          metaCycles: 'GET /api/user/gift-box/meta/cycles'
        }
      },
      commonParameters: {
        userId: '用户标识，1-64位字符串，多用户接口必填',
        scene: '使用场景（如 living_room、bedroom、study 等），可选，1-32位字符串',
        mood: '情绪目标（如 sleep、relax、focus、romance 等），可选',
        season: '季节偏好（spring、summer、autumn、winter），可选',
        days: '预测天数，可选值 7、14、30，默认 7',
        rating: '用户评分，1-5分，支持一位小数',
        allergyTags: '过敏标签数组，自动去重',
        excludeTags: '排斥标签数组，自动去重',
        commonSpaces: '常用空间数组',
        desiredMoods: '期望氛围数组',
        intensityPreference: '浓度偏好（light、medium、strong）',
        roomCode: '房间代码（如 living_room、bedroom 等），安全接口使用',
        inspectionType: '检查类型（pre_use、during_use、post_use、environment、full）',
        eventType: '事件类型（ignite 点燃、extinguish 熄灭、check 检查）',
        hasChild: '是否有儿童在场（true/false），安全因子',
        hasPet: '是否有宠物在场（true/false），安全因子',
        isPoorVentilation: '是否通风不良（true/false），安全因子',
        combustibleDistance: '可燃物距离（cm），安全因子',
        ventilationDistance: '通风距离（cm），安全因子',
        wickLength: '烛芯长度（mm），安全因子',
        relationship: '关系类型（lover、family、friend、colleague、teacher、client），礼盒接口使用',
        ageGroup: '年龄段（child、teen、young_adult、adult、middle_aged、senior），礼盒接口使用',
        giftOccasion: '送礼场景（birthday、anniversary、valentines 等17种），礼盒接口使用',
        giftBoxTheme: '礼盒主题（romance、warmth、friendship 等10种），礼盒接口使用',
        budgetRange: '预算区间（budget 50-150、standard 150-300、premium 300-600、luxury 600-2000），礼盒接口使用',
        packagingPreference: '包装偏好（simple、gift、luxury、festive、eco），礼盒接口使用',
        subscriptionCycle: '订阅周期（monthly、bimonthly、quarterly、biannual、annual），礼盒接口使用',
        forbiddenTags: '禁忌香型标签（allergyTags 过敏、excludeTags 排斥），自动去重，礼盒接口使用',
        matchScore: '匹配度评分（0-100），礼盒推荐结果返回',
        tabooAvoided: '禁忌规避结果，礼盒推荐结果返回',
        needsRestock: '是否需要补货，礼盒推荐结果返回'
      },
      errorCodes: {
        400: '参数校验失败/请求格式错误',
        404: '资源未找到',
        500: '服务器内部错误'
      }
    }
  }));
});

app.use('/api/inventory', inventoryRoutes);
app.use('/api/consumption', consumptionRoutes);
app.use('/api/replenishment', replenishmentRoutes);
app.use('/api/tips', tipsRoutes);
app.use('/api/user', multiUserRoutes);
app.use('/api/scent', scentManagementRoutes);
app.use('/api/scent-user', userScentPreferencesRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api/gift-box', giftBoxRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
