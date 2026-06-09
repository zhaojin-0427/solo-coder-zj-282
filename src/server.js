const app = require('./app');

const PORT = process.env.PORT || 9301;

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  香薰蜡烛燃烧时长预测与补货建议 API 服务`);
  console.log(`  服务已启动，端口: ${PORT}`);
  console.log(`  访问地址: http://localhost:${PORT}`);
  console.log(`========================================\n`);
});
