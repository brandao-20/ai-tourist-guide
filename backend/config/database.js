const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config(); // Load environment variables from the .env file

// Sequelize configuration using environment variables
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST, // Hostname ('db' for Docker services)
  port: process.env.DB_PORT, // Port (5432 for PostgreSQL in Docker)
  dialect: 'postgres',
});

// Test the connection to the database
sequelize.authenticate()
  .then(() => {
    console.log('Connection to the database has been established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });

module.exports = sequelize; // Export the Sequelize instance
