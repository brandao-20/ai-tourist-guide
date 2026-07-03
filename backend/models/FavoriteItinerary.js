'use strict';

const MAX_FAVORITE_NAME_LENGTH = 120;

module.exports = (sequelize, DataTypes) => {
  const FavoriteItinerary = sequelize.define('FavoriteItinerary', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    name: {
      type: DataTypes.STRING(MAX_FAVORITE_NAME_LENGTH),
      allowNull: false,
      defaultValue: 'Untitled itinerary',
      validate: {
        notEmpty: true,
        len: [1, MAX_FAVORITE_NAME_LENGTH],
      },
    },
    itinerary: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    map_data: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
  }, {
    tableName: 'FavoriteItineraries',
    timestamps: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['createdAt'] },
    ],
  });

  FavoriteItinerary.associate = (models) => {
    FavoriteItinerary.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
      onDelete: 'CASCADE',
    });
  };

  return FavoriteItinerary;
};
