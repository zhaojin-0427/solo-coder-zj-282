const { error } = require('../utils/response');

function responseWrapper(req, res, next) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
}

function notFoundHandler(req, res) {
  res.status(404).json(error(404, '接口不存在'));
}

function errorHandler(err, req, res, next) {
  console.error(err);
  res.status(500).json(error(500, '服务器内部错误', err.message));
}

module.exports = { responseWrapper, notFoundHandler, errorHandler };
