const dotenv = require('dotenv');
const db = require('../models');

dotenv.config();

async function syncDatabase() {
  const alter = process.env.DB_SYNC_ALTER === 'true';

  await db.sequelize.authenticate();
  await db.sequelize.sync({ alter });

  console.log(`Database synchronized successfully. alter=${alter}`);
  await db.sequelize.close();
}

syncDatabase().catch(async (error) => {
  console.error('Unable to synchronize the database:', error);
  try {
    await db.sequelize.close();
  } catch (_) {
    // ignore close errors
  }
  process.exit(1);
});
