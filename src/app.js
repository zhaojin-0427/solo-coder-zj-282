const express = require('express');
const { responseWrapper, notFoundHandler, errorHandler } = require('./middleware/responseWrapper');

const inventoryRoutes = require('./routes/inventory');
const consumptionRoutes = require('./routes/consumption');
const replenishmentRoutes = require('./routes/replenishment');
const tipsRoutes = require('./routes/tips');
const multiUserRoutes = require('./routes/multiUser');

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
    version: '2.0.0',
    description: '支持多用户使用画像与批次化补货计划',
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
        }
      },
      commonParameters: {
        userId: '用户标识，1-64位字符串，多用户接口必填',
        scene: '使用场景（如客厅、卧室、书房等），可选，1-32位字符串',
        days: '预测天数，可选值 7、14、30，默认 7'
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

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
