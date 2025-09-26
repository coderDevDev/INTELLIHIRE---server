const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const emailService = require('../services/email.service');

// Middleware for validation
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Register new user
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('role').isIn(['applicant', 'admin', 'employer']),
    body('firstName').notEmpty(),
    body('lastName').notEmpty(),
    body('phone').notEmpty(),
    body('address').notEmpty(),
    body('gender').notEmpty(),
    body('dob').notEmpty(),
    validate
  ],
  async (req, res) => {
    try {
      const {
        email,
        password,
        role,
        firstName,
        lastName,
        phone,
        address,
        gender,
        dob
      } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Create new user
      const user = new User({
        email,
        password,
        role,
        firstName,
        lastName,
        phoneNumber: phone,
        address: { street: address },
        gender,
        dob: new Date(dob)
      });

      await user.save();

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id, role: user.role },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      // Send welcome email (async, don't wait for it)
      emailService.sendWelcome(email, firstName).catch(error => {
        console.error('Failed to send welcome email:', error.message);
      });

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          address: user.address,
          gender: user.gender,
          dob: user.dob
        }
      });
    } catch (error) {
      res
        .status(500)
        .json({ message: 'Error registering user', error: error.message });
    }
  }
);

// Login user
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').exists(),
    validate
  ],
  async (req, res) => {
    try {
      const { email, password } = req.body;

      console.log({ email, password });

      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id, role: user.role },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName
        }
      });
    } catch (error) {
      res
        .status(500)
        .json({ message: 'Error logging in', error: error.message });
    }
  }
);

// Forgot password
router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail(), validate],
  async (req, res) => {
    try {
      const { email } = req.body;

      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        return res
          .status(404)
          .json({ message: 'User not found with this email address' });
      }

      // Generate reset token
      const resetToken = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '1h' }
      );

      // Send password reset email
      const emailResult = await emailService.sendPasswordReset(
        email,
        resetToken
      );

      if (!emailResult.success) {
        return res.status(500).json({
          message: 'Failed to send reset email',
          error: emailResult.error
        });
      }

      res.json({
        message: 'Password reset email sent successfully',
        // In development, include the token for testing
        ...(process.env.NODE_ENV === 'development' && { resetToken })
      });
    } catch (error) {
      res.status(500).json({
        message: 'Error processing forgot password request',
        error: error.message
      });
    }
  }
);

// Reset password
router.post(
  '/reset-password',
  [body('token').notEmpty(), body('password').isLength({ min: 6 }), validate],
  async (req, res) => {
    try {
      const { token, password } = req.body;

      // Verify token
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'your-secret-key'
      );

      // Find user
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res
          .status(404)
          .json({ message: 'Invalid or expired reset token' });
      }

      // Update password
      user.password = password;
      await user.save();

      res.json({
        message: 'Password reset successfully'
      });
    } catch (error) {
      if (
        error.name === 'JsonWebTokenError' ||
        error.name === 'TokenExpiredError'
      ) {
        return res
          .status(400)
          .json({ message: 'Invalid or expired reset token' });
      }
      res
        .status(500)
        .json({ message: 'Error resetting password', error: error.message });
    }
  }
);

module.exports = router;
