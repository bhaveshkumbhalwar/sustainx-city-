const jwt = require('jsonwebtoken');
const User = require('../models/User');
const rewardService = require('../services/rewardService');
const { notifyMany } = require('../services/notificationService');
const { normalizeRole } = require('../config/roles');

// Generate JWT with id, role, and block embedded
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      block: user.block || null,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// @desc    Login user
// @route   POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    console.log("Login attempt for:", email);

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      console.log(`[LOGIN]: User not found: ${email}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (user.isActive === false) {
      return res.status(401).json({ message: 'This account has been deactivated. Contact your administrator.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      console.log(`[LOGIN]: Password mismatch for ${email}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Role mismatch check (aliases like citizen/field_officer are normalized)
    const expectedRole = normalizeRole(role) || role;
    if (expectedRole && user.role !== expectedRole) {
      console.log(`[LOGIN]: Role mismatch for ${email}. Expected ${expectedRole}, got ${user.role}`);
      return res.status(401).json({
        message: `This account is not a ${role} account. Please select the correct role.`,
      });
    }

    res.json({
      token: generateToken(user),
      user: user.toJSON(),
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @desc    Register student
// @route   POST /api/auth/register
const register = async (req, res) => {
  try {
    const { name, email, dept, password, block } = req.body;

    const studentBlock = block || 'A';

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please fill all required fields' });
    }

    // Ensure uniqueness
    let isUnique = await User.findOne({ email: email.toLowerCase() });
    if (isUnique) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    const user = await User.create({
      password,
      role: 'student',
      name,
      email: email.toLowerCase(),
      dept: dept || '',
      block: String(studentBlock).toUpperCase(),
      rewardPoints: 0,
    });

    // Create signup bonus through the server-verified reward pipeline
    await rewardService.credit({
      userId: user._id,
      activity: 'Signup Bonus',
      points: 100,
      reason: 'Signup welcome bonus',
      actorId: user._id,
    });

    console.log(`[SIGNUP] New student ${user.email} received 100 pts signup bonus`);

    // ✅ Notify Admins
    await notifyMany(
      (await User.find({ role: 'admin' }).select('_id')).map((a) => a._id),
      `New user registered: ${user.name} (${user.email})`,
      'user'
    );

    res.status(201).json({
      token: generateToken(user),
      user: user.toJSON(),
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @desc    Forgot Password Request
// @route   POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Please provide Email' });
    }

    const user = await User.findOne({ 
      email: email.trim().toLowerCase() 
    });

    if (!user) {
      // For security, you might want to return the same message regardless of whether user exists
      // but for this project's purpose of debugging/internal use, being explicit is fine.
      return res.status(404).json({ message: 'User not found with matching email.' });
    }

    // Since we don't have SMTP setup, we simulate the "Reset Email Sent"
    console.log(`🔑 [PASSWORD RESET] Request received for ${user.email}`);
    
    res.json({ 
      message: 'Password reset request received. Instructions have been sent to your administrator or registered email.' 
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
const getMe = async (req, res) => {
  res.json({ user: req.user });
};

module.exports = { login, register, getMe, forgotPassword };
