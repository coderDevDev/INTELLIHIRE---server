const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth.middleware');
const Company = require('../models/company.model');
const multer = require('multer');
const path = require('path');

// Configure multer for company logo upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/company-logos/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
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

// Get all companies (public)
router.get('/', async (req, res) => {
  try {
    const { industry, isGovernment, search, page = 1, limit = 10 } = req.query;

    const query = {};

    if (industry) query.industry = new RegExp(industry, 'i');
    if (isGovernment) query.isGovernment = isGovernment === 'true';
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }

    const companies = await Company.find(query)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Company.countDocuments(query);

    res.json({
      companies,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error fetching companies', error: error.message });
  }
});

// Get company by ID (public)
router.get('/:id', async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    res.json(company);
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error fetching company', error: error.message });
  }
});

// Create new company (admin only)
router.post(
  '/',
  [
    auth,
    authorize('admin'),
    body('name').notEmpty(),
    body('industry').notEmpty(),
    validate
  ],
  async (req, res) => {
    try {
      const company = new Company({
        ...req.body,
        adminId: req.user._id
      });

      await company.save();
      res.status(201).json(company);
    } catch (error) {
      res
        .status(500)
        .json({ message: 'Error creating company', error: error.message });
    }
  }
);

// Update company (admin/company admin only)
router.put(
  '/:id',
  [auth, authorize('admin', 'employer'), validate],
  async (req, res) => {
    try {
      const company = await Company.findById(req.params.id);

      if (!company) {
        return res.status(404).json({ message: 'Company not found' });
      }

      // Check if user has permission to update this company
      if (
        req.user.role === 'employer' &&
        company.adminId.toString() !== req.user._id.toString()
      ) {
        return res
          .status(403)
          .json({ message: 'Not authorized to update this company' });
      }

      Object.assign(company, req.body);
      await company.save();

      res.json(company);
    } catch (error) {
      res
        .status(500)
        .json({ message: 'Error updating company', error: error.message });
    }
  }
);

// Upload company logo (admin/company admin only)
router.post(
  '/:id/logo',
  [auth, authorize('admin', 'employer'), upload.single('logo')],
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const company = await Company.findById(req.params.id);

      if (!company) {
        return res.status(404).json({ message: 'Company not found' });
      }

      // Check if user has permission to update this company
      if (
        req.user.role === 'employer' &&
        company.adminId.toString() !== req.user._id.toString()
      ) {
        return res
          .status(403)
          .json({ message: 'Not authorized to update this company' });
      }

      // Delete old logo if exists
      if (company.logo) {
        const fs = require('fs');
        const oldLogoPath = path.join(__dirname, '../../', company.logo);
        if (fs.existsSync(oldLogoPath)) {
          fs.unlinkSync(oldLogoPath);
        }
      }

      company.logo = req.file.path;
      await company.save();

      res.json(company);
    } catch (error) {
      res
        .status(500)
        .json({ message: 'Error uploading logo', error: error.message });
    }
  }
);

// Delete company (admin only)
router.delete('/:id', [auth, authorize('admin')], async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Delete company logo if exists
    if (company.logo) {
      const fs = require('fs');
      const logoPath = path.join(__dirname, '../../', company.logo);
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath);
      }
    }

    await company.remove();
    res.json({ message: 'Company deleted successfully' });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error deleting company', error: error.message });
  }
});

// Get company jobs (public)
router.get('/:id/jobs', async (req, res) => {
  try {
    const { status = 'active', page = 1, limit = 10 } = req.query;

    const query = {
      companyId: req.params.id,
      status,
      expiryDate: { $gt: new Date() }
    };

    const jobs = await Job.find(query)
      .sort('-postedDate')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('categoryId', 'name');

    const total = await Job.countDocuments(query);

    res.json({
      jobs,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error fetching company jobs', error: error.message });
  }
});

module.exports = router;
