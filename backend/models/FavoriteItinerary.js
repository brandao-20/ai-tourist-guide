module.exports = (sequelize, DataTypes) => {
    const FavoriteItinerary = sequelize.define('FavoriteItinerary', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING
      },
      itinerary: {
        type: DataTypes.JSONB
      },
      map_data: {
        type: DataTypes.JSONB
      }
    }, {
      tableName: 'FavoriteItineraries',
      timestamps: true
    });
  
    return FavoriteItinerary;
  };
  