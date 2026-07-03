const { Sequelize } = require('sequelize');
const { appConfig } = require('./env');

const { database } = appConfig;

const sequelizeOptions = {
  dialect: 'postgres',
  logging: database.logging ? console.log : false,
};

const sequelize = database.url
  ? new Sequelize(database.url, sequelizeOptions)
  : new Sequelize(
    database.name,
    database.user,
    database.password,
    {
      ...sequelizeOptions,
      host: database.host,
      port: database.port,
    }
  );

module.exports = sequelize;
