// models/RecentSearches.js
"use strict";
module.exports = (sequelize, DataTypes) => {
  const RecentSearches = sequelize.define("RecentSearches", {
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    query_params: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    itinerary: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    monuments: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    directions: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: "RecentSearches", // nome exato da tabela, com a capitalização definida
    timestamps: false // Já que estamos usando os campos created_at e updated_at manualmente
  });

  RecentSearches.associate = models => {
    // Define que RecentSearches pertence a User (modelo definido com "User")
    RecentSearches.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "user",
      onDelete: "CASCADE"
    });
  };

  return RecentSearches;
};
