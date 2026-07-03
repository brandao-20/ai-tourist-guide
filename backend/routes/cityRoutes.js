const express = require('express');
const {
  listCountries,
  listCitiesByCountry,
  normalizeCountryCode,
} = require('../services/cityCatalogService');

const router = express.Router();

router.get('/countries', (req, res) => {
  const countries = listCountries();
  return res.json({ countries });
});

router.get('/', (req, res) => {
  const countryCode = normalizeCountryCode(req.query.countryCode);

  if (!countryCode) {
    return res.status(400).json({ error: "O parâmetro 'countryCode' é obrigatório." });
  }

  const cities = listCitiesByCountry(countryCode);

  if (cities.length === 0) {
    return res.status(404).json({ message: `Nenhuma cidade encontrada para o país ${countryCode}.` });
  }

  return res.json({ cities });
});

module.exports = router;
