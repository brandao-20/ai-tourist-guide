const { appConfig } = require('../config/env');
const db = require('../models');

function getSyncOptions() {
  if (appConfig.database.syncAlter && appConfig.isProduction) {
    throw new Error('DB_SYNC_ALTER must not be enabled in production. Use explicit migrations instead.');
  }

  return appConfig.database.syncAlter ? { alter: true } : {};
}

async function closeDatabaseConnection() {
  try {
    await db.sequelize.close();
  } catch (error) {
    // Ignore shutdown errors so the original sync result remains clear.
  }
}

async function syncDatabase() {
  const syncOptions = getSyncOptions();

  await db.sequelize.authenticate();
  await db.sequelize.sync(syncOptions);

  console.log(`Database synchronized successfully. alter=${Boolean(syncOptions.alter)}`);
  await closeDatabaseConnection();
}

syncDatabase().catch(async (error) => {
  console.error('Unable to synchronize the database:', error.message);
  await closeDatabaseConnection();
  process.exit(1);
});

module.exports = {
  getSyncOptions,
  syncDatabase,
};
