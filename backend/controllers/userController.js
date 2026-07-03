const { User } = require('../models');
const bcrypt = require('bcrypt');

// Function to list all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll();
    res.json(users); 
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error }); 
  }
};

// Function to get a specific user by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id); 
    if (!user) {
      return res.status(404).json({ message: 'User not found' }); 
    }
    res.json(user); 
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user', error }); 
  }
};

// Function to create a new user
exports.createUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if all required fields are filled
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please fill in all the fields.' });
    }

    // Check if the user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'Email is already in use.' });
    }

    // Create a new user
    const user = await User.create({ name, email, password });

    // Remove the password from the returned object
    const userData = user.toJSON();
    delete userData.password;

    res.status(201).json(userData); 
  } catch (error) {
    res.status(500).json({ message: 'Error creating user', error }); 
  }
};

// Function to update a user by ID
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    await user.update(req.body); 
    res.json(user); 
  } catch (error) {
    res.status(500).json({ message: 'Error updating user', error }); 
  }
};

// Function to delete a user by ID
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id); 
    if (!user) {
      return res.status(404).json({ message: 'User not found' }); 
    }
    await user.destroy(); 
    res.status(204).json({ message: 'User successfully deleted' }); 
  } catch (error) {
    res.status(500).json({ message: 'Error deleting user', error }); 
  }
};

// Function to log in a user
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if all required fields are filled
    if (!email || !password) {
      return res.status(400).json({ message: 'Please fill in all the fields.' });
    }

    // Check if the user exists
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Verify the password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Authenticate the user using session
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
    };

    res.status(200).json({ message: 'Login successful', user: req.session.user }); 
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error });
  }
};
