const express = require('express');
const { responseWrapper, notFoundHandler, errorHandler } = require('./middleware/responseWrapper');

const inventoryRoutes = require('./routes/inventory');
const consumptionRoutes = require('./routes/consumption');
const replenishmentRoutes = require('./routes/replenishment');
const tipsRoutes = require('./routes/tips');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(responseWrapper);

app.get('/', (req, res) => {
  const { success } = require('./utils/response');
  res.json(success({
    name: '香薰蜡烛燃烧时长预测与补货建议 API 服务',
    version: '1.0.0',
    endpoints: {
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
    }
  }));
});

app.use('/api/inventory', inventoryRoutes);
app.use('/api/consumption', consumptionRoutes);
app.use('/api/replenishment', replenishmentRoutes);
app.use('/api/tips', tipsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
