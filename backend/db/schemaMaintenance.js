const db = require('../models');
const { DEFAULT_TRAVEL_PREFERENCES } = require('../services/userPreferenceService');

async function describeTableSafely(queryInterface, tableName) {
  try {
    return await queryInterface.describeTable(tableName);
  } catch (error) {
    return null;
  }
}

async function addColumnIfMissing(queryInterface, tableDescription, tableName, columnName, definition) {
  if (!tableDescription || tableDescription[columnName]) {
    return false;
  }

  await queryInterface.addColumn(tableName, columnName, definition);
  return true;
}

async function ensureUsersTableColumns() {
  const queryInterface = db.sequelize.getQueryInterface();
  const usersTable = await describeTableSafely(queryInterface, 'Users');

  if (!usersTable) {
    return [];
  }

  const addedColumns = [];

  if (await addColumnIfMissing(queryInterface, usersTable, 'Users', 'travel_preferences', {
    type: db.Sequelize.DataTypes.JSONB,
    allowNull: false,
    defaultValue: DEFAULT_TRAVEL_PREFERENCES,
  })) {
    addedColumns.push('Users.travel_preferences');
  }

  if (await addColumnIfMissing(queryInterface, usersTable, 'Users', 'profileImage', {
    type: db.Sequelize.DataTypes.STRING,
    allowNull: true,
  })) {
    addedColumns.push('Users.profileImage');
  }

  if (await addColumnIfMissing(queryInterface, usersTable, 'Users', 'google_id', {
    type: db.Sequelize.DataTypes.STRING,
    allowNull: true,
    unique: true,
  })) {
    addedColumns.push('Users.google_id');
  }

  return addedColumns;
}

async function runSchemaMaintenance() {
  const addedColumns = await ensureUsersTableColumns();

  if (addedColumns.length > 0) {
    console.log(`Database schema maintenance added: ${addedColumns.join(', ')}`);
  }

  return { addedColumns };
}

module.exports = {
  ensureUsersTableColumns,
  runSchemaMaintenance,
};
