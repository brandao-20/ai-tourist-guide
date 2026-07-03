'use strict';

const { Attraction } = require('../models');

// Function to list all attractions
exports.getAllAttractions = async (req, res) => {
  try {
    const attractions = await Attraction.findAll();
    res.status(200).json(attractions);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving attractions.', error });
  }
};

// Function to get an attraction by ID
exports.getAttractionById = async (req, res) => {
  try {
    const attraction = await Attraction.findByPk(req.params.id); 
    if (attraction) {
      res.status(200).json(attraction); 
    } else {
      res.status(404).json({ message: 'Attraction not found.' }); 
    }
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving the attraction.', error }); 
  }
};

// Function to create a new attraction
exports.createAttraction = async (req, res) => {
  try {
    const newAttraction = await Attraction.create(req.body);
    res.status(201).json(newAttraction);
  } catch (error) {
    res.status(500).json({ message: 'Error creating the attraction.', error }); 
  }
};

// Function to update an attraction
exports.updateAttraction = async (req, res) => {
  try {
    const attraction = await Attraction.findByPk(req.params.id);
    if (attraction) {
      await attraction.update(req.body); 
      res.status(200).json(attraction); 
    } else {
      res.status(404).json({ message: 'Attraction not found.' }); 
    }
  } catch (error) {
    res.status(500).json({ message: 'Error updating the attraction.', error }); 
  }
};

// Function to delete an attraction
exports.deleteAttraction = async (req, res) => {
  try {
    const attraction = await Attraction.findByPk(req.params.id);
    if (attraction) {
      await attraction.destroy(); 
      res.status(200).json({ message: 'Attraction successfully deleted.' }); 
    } else {
      res.status(404).json({ message: 'Attraction not found.' }); 
    }
  } catch (error) {
    res.status(500).json({ message: 'Error deleting the attraction.', error });
  }
};
