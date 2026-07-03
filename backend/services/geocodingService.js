const axios = require('axios');

async function geocodeAddress(address) {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey || !address) {
    return null;
  }

  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address,
        key: apiKey,
      },
    });

    if (response.data.status !== 'OK' || !response.data.results?.length) {
      return null;
    }

    const location = response.data.results[0].geometry.location;
    return {
      lat: location.lat,
      lng: location.lng,
    };
  } catch (error) {
    console.error('Geocoding request failed:', error.response ? error.response.data : error.message);
    return null;
  }
}

module.exports = {
  geocodeAddress,
};
