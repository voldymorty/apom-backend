require('dotenv').config();
const app = require('./src/app');
const http = require('http');
const db = require('./src/models/index');
const { startExpiryCron } = require("./src/cron-jobs/expirePendingPayments");

const PORT = 5000;

// Create HTTP server ONLY
const server = http.createServer(app);

// db.sequelize.sync({ alter: true })
db.sequelize.sync()
  .then(() => {
    console.log('✅ Database connected successfully');
    server.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
      console.log(`🚀 Swagger docs at http://localhost:${PORT}/api-docs`);
    });

    startExpiryCron();
  })
  .catch((err) => {
    console.error('❌ Unable to connect to the database:', err);
  });
