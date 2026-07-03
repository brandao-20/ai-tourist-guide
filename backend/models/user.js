'use strict';

const bcrypt = require('bcrypt');

const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;

function normalizeName(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(MAX_NAME_LENGTH),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, MAX_NAME_LENGTH],
      },
    },
    email: {
      type: DataTypes.STRING(MAX_EMAIL_LENGTH),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        len: [3, MAX_EMAIL_LENGTH],
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    google_id: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true,
    },
    profileImage: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    tableName: 'Users',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['email'] },
      { unique: true, fields: ['google_id'] },
    ],
  });

  User.associate = (models) => {
    User.hasMany(models.RecentSearches, {
      foreignKey: 'user_id',
      as: 'recentSearches',
      onDelete: 'CASCADE',
    });

    User.hasMany(models.FavoriteItinerary, {
      foreignKey: 'user_id',
      as: 'favoriteItineraries',
      onDelete: 'CASCADE',
    });
  };

  User.beforeValidate((user) => {
    user.name = normalizeName(user.name);
    user.email = normalizeEmail(user.email);
  });

  User.beforeCreate(async (user) => {
    if (user.password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(user.password, salt);
    }
  });

  return User;
};
