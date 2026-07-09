'use strict';

module.exports = (sequelize, DataTypes) => {
  const RecentSearches = sequelize.define('RecentSearches', {
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
    query_params: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    itinerary: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    monuments: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    directions: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    routeMetadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  }, {
    tableName: 'RecentSearches',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['updated_at'] },
    ],
  });

  RecentSearches.associate = (models) => {
    RecentSearches.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
      onDelete: 'CASCADE',
    });
  };

  return RecentSearches;
};
