const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { createNotification, notifyMany } = require('../services/notificationService');
const { ROLE_LABELS } = require('../config/roles');
const { audit } = require('../services/auditService');
const { sanitizeQuery } = require('../utils/validate');

// @desc    Get all users (admin)
// @route   GET /api/users
const getUsers = async (req, res) => {
  try {
    const role = sanitizeQuery(req.query.role);
    const filter = {};
    if (role) filter.role = role;
    const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const VALID_ROLES = ['student', 'collector', 'admin'];

// @desc    Create user (admin)
// @route   POST /api/users
const createUser = async (req, res) => {
  try {
    const { role, name, email, dept, block, phone, city, zone, ward, area, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please fill all required fields (name, email, password)' });
    }

    const resolvedRole = VALID_ROLES.includes(role) ? role : 'student';

    // Validate block for students and collectors — required by schema
    if (['student', 'collector'].includes(resolvedRole) && !block) {
      return res.status(400).json({ message: `Block is required when creating a ${resolvedRole}` });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: `Email "${email.toLowerCase()}" already exists. Choose a different email.` });
    }

    const userData = {
      password,
      role: resolvedRole,
      name,
      email: email.toLowerCase(),
      dept: dept || '',
      phone: phone || '',
      city: city || '',
      zone: zone || '',
      ward: ward || '',
      area: area || '',
    };

    // Add block for student/collector roles (already validated above)
    if (['student', 'collector'].includes(resolvedRole) && block) {
      userData.block = String(block).toUpperCase();
    }

    const user = await User.create(userData);
    console.log(`[USERS] Created ${userData.role} | block: ${userData.block || 'N/A'} | email: ${userData.email}`);

    await audit({
      actor: req.user,
      action: 'user.created',
      targetType: 'User',
      targetId: user._id,
      meta: { role: userData.role, email: userData.email },
      req,
    });

    await createNotification(
      user._id,
      `Welcome to SustainX, ${user.name}! Your account as a ${ROLE_LABELS[userData.role] || userData.role} has been created.`,
      'info'
    );

    res.status(201).json(user.toJSON());
  } catch (err) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Update user fields
// @route   PUT /api/users/:id
const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Only allow self-update or admin
    if (req.user.role !== 'admin' && req.user._id.toString() !== user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const allowedFields = ['name', 'email', 'dept', 'avatar', 'phone', 'block', 'city', 'zone', 'ward', 'area'];
    // Only admins may toggle account status
    if (req.user.role === 'admin') allowedFields.push('isActive');
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) user[field] = field === 'block' ? String(req.body[field]).toUpperCase() : req.body[field];
    });

    await user.save();

    if (req.user.role === 'admin') {
      await audit({ actor: req.user, action: 'user.updated', targetType: 'User', targetId: user._id, meta: req.body, req });
    }

    res.json(user.toJSON());
  } catch (err) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Change password
// @route   PUT /api/users/:id/password
const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Please provide old and new passwords' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Only allow self-update
    if (req.user._id.toString() !== user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const isMatch = await user.matchPassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// @desc    Delete user (admin)
// @route   DELETE /api/users/:id
const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await audit({ actor: req.user, action: 'user.deleted', targetType: 'User', targetId: user._id, meta: { name: user.name, email: user.email }, req });
    res.json({ message: `User ${user.name} deleted` });
  } catch (err) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = { getUsers, getUserById, createUser, updateUser, changePassword, deleteUser };