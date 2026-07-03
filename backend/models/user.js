'use strict';
const bcrypt = require('bcrypt');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true, // Field can be null (for OAuth users)
    },
    google_id: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true,
    },
    google_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    profileImage: {
      type: DataTypes.STRING,
      allowNull: true, // Field can be null if no image is provided
    },
    created_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'Users',
    timestamps: true,
  });

  // Define associations with other models
  User.associate = (models) => {
    User.hasMany(models.RecentSearches, { foreignKey: 'user_id' });
    User.hasMany(models.FavoriteItinerary, { foreignKey: 'user_id' });
  };

  // Hash the password before creating the user
  User.beforeCreate(async (user, options) => {
    if (user.password) {
      const salt = await bcrypt.genSalt(10); // Generate a salt for hashing
      user.password = await bcrypt.hash(user.password, salt); // Hash the password with the salt
    }
  });

  return User;
};
