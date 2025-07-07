const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth.middleware');
const User = require('../models/user.model');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/profiles/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'Invalid file type. Only JPEG, PNG and GIF images are allowed.'
        )
      );
    }
  }
});

// Middleware for validation
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Get current user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error fetching profile', error: error.message });
  }
});

// Update user profile
router.put(
  '/profile',
  [
    auth,
    body('firstName').optional().trim().isLength({ min: 2 }),
    body('lastName').optional().trim().isLength({ min: 2 }),
    body('phoneNumber').optional().trim(),
    body('address').optional().isObject(),
    body('experience').optional().isArray(),
    body('education').optional().isArray(),
    body('certification').optional().isArray(),
    validate
  ],
  async (req, res) => {
    try {
      const updates = {};
      const allowedFields = [
        'firstName',
        'lastName',
        'phoneNumber',
        'address',
        'experience',
        'education',
        'certification'
      ];

      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      });

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: updates },
        { new: true, runValidators: true }
      ).select('-password');

      res.json(user);
    } catch (error) {
      res
        .status(500)
        .json({ message: 'Error updating profile', error: error.message });
    }
  }
);

// Upload profile picture
router.post(
  '/profile/picture',
  [auth, upload.single('picture')],
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const user = await User.findById(req.user._id);

      // Delete old profile picture if exists
      if (user.profilePicture) {
        const oldPicturePath = path.join(
          __dirname,
          '../../',
          user.profilePicture
        );
        if (fs.existsSync(oldPicturePath)) {
          fs.unlinkSync(oldPicturePath);
        }
      }

      user.profilePicture = req.file.path;
      await user.save();

      res.json({ profilePicture: user.profilePicture });
    } catch (error) {
      // Clean up uploaded file if update fails
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({
        message: 'Error uploading profile picture',
        error: error.message
      });
    }
  }
);

// Get all users (admin only)
router.get('/', [auth, authorize('admin')], async (req, res) => {
  try {
    const { role, search, page = 1, limit = 10 } = req.query;
    const query = {};

    if (role) query.role = role;
    if (search) {
      query.$or = [
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error fetching users', error: error.message });
  }
});

// Get user by ID (admin only)
router.get(
  '/:id',
  [auth, authorize('admin', 'applicant')],
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id).select('-password');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      res
        .status(500)
        .json({ message: 'Error fetching user', error: error.message });
    }
  }
);

// Update user (admin only)
router.put(
  '/:id',
  [
    auth,
    authorize('admin'),
    body('firstName').optional().trim().isLength({ min: 2 }),
    body('lastName').optional().trim().isLength({ min: 2 }),
    body('role').optional().isIn(['applicant', 'employer', 'admin']),
    body('isActive').optional().isBoolean(),
    validate
  ],
  async (req, res) => {
    try {
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true, runValidators: true }
      ).select('-password');

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      res
        .status(500)
        .json({ message: 'Error updating user', error: error.message });
    }
  }
);

// Delete user (admin only)
router.delete('/:id', [auth, authorize('admin')], async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete profile picture if exists
    if (user.profilePicture) {
      const picturePath = path.join(__dirname, '../../', user.profilePicture);
      if (fs.existsSync(picturePath)) {
        fs.unlinkSync(picturePath);
      }
    }

    await user.remove();
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error deleting user', error: error.message });
  }
});

module.exports = router;
