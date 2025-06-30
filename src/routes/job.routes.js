const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth.middleware');
const Job = require('../models/job.model');
const Company = require('../models/company.model');

// Middleware for validation
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Get all jobs (public)
router.get('/', async (req, res) => {
  try {
    const {
      category,
      location,
      type,
      search,
      page = 1,
      limit = 10,
      sort = '-postedDate'
    } = req.query;

    const query = { status: 'active', expiryDate: { $gt: new Date() } };

    if (category) query.categoryId = category;
    if (location) query.location = new RegExp(location, 'i');
    if (type) query.employmentType = type;
    if (search) {
      query.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }

    const jobs = await Job.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('companyId', 'name logo')
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
      .json({ message: 'Error fetching jobs', error: error.message });
  }
});

// Get all jobs for admin (includes all statuses)
router.get('/admin/all', [auth, authorize('admin')], async (req, res) => {
  try {
    const {
      category,
      location,
      type,
      search,
      status,
      page = 1,
      limit = 10,
      sort = '-postedDate'
    } = req.query;

    const query = {};

    // Add filters
    if (category) query.categoryId = category;
    if (location) query.location = new RegExp(location, 'i');
    if (type) query.employmentType = type;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }

    const jobs = await Job.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('companyId', 'name logo')
      .populate('categoryId', 'name');

    const total = await Job.countDocuments(query);

    res.json({
      jobs,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error fetching jobs', error: error.message });
  }
});

// Get job by ID (public)
router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('companyId', 'name logo description industry website')
      .populate('categoryId', 'name');

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Increment view count
    job.viewCount += 1;
    await job.save();

    res.json(job);
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error fetching job', error: error.message });
  }
});

// Create new job (employer/admin only)
router.post(
  '/',
  [
    auth,
    authorize('employer', 'admin'),
    body('title').notEmpty(),
    body('companyId').isMongoId(),
    body('categoryId').isMongoId(),
    body('location').notEmpty(),
    body('employmentType').isIn([
      'Full-time',
      'Part-time',
      'Contract',
      'Temporary',
      'Internship'
    ]),
    validate
  ],
  async (req, res) => {
    try {
      const jobData = {
        ...req.body,
        createdBy: req.user._id
      };

      const job = new Job(jobData);
      await job.save();

      res.status(201).json(job);
    } catch (error) {
      res
        .status(500)
        .json({ message: 'Error creating job', error: error.message });
    }
  }
);

// Update job (employer/admin only)
router.put(
  '/:id',
  [auth, authorize('employer', 'admin'), validate],
  async (req, res) => {
    try {
      const job = await Job.findById(req.params.id);

      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check if user has permission to update this job
      if (req.user.role === 'employer') {
        const company = await Company.findOne({ adminId: req.user._id });
        if (!company || job.companyId.toString() !== company._id.toString()) {
          return res
            .status(403)
            .json({ message: 'Not authorized to update this job' });
        }
      }

      Object.assign(job, req.body);
      await job.save();

      res.json(job);
    } catch (error) {
      res
        .status(500)
        .json({ message: 'Error updating job', error: error.message });
    }
  }
);

// Delete job (employer/admin only)
router.delete(
  '/:id',
  [auth, authorize('employer', 'admin')],
  async (req, res) => {
    try {
      const job = await Job.findById(req.params.id);

      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check if user has permission to delete this job
      if (req.user.role === 'employer') {
        const company = await Company.findOne({ adminId: req.user._id });
        if (!company || job.companyId.toString() !== company._id.toString()) {
          return res
            .status(403)
            .json({ message: 'Not authorized to delete this job' });
        }
      }

      await job.remove();
      res.json({ message: 'Job deleted successfully' });
    } catch (error) {
      res
        .status(500)
        .json({ message: 'Error deleting job', error: error.message });
    }
  }
);

// Get featured jobs (public)
router.get('/featured/list', async (req, res) => {
  try {
    const jobs = await Job.find({
      status: 'active',
      isFeatured: true,
      expiryDate: { $gt: new Date() }
    })
      .sort('-postedDate')
      .limit(6)
      .populate('companyId', 'name logo')
      .populate('categoryId', 'name');

    res.json(jobs);
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error fetching featured jobs', error: error.message });
  }
});

// Get government jobs (public)
router.get('/government/list', async (req, res) => {
  try {
    const governmentCompanies = await Company.find({
      isGovernment: true
    }).select('_id');
    const companyIds = governmentCompanies.map(company => company._id);

    const jobs = await Job.find({
      companyId: { $in: companyIds },
      status: 'active',
      expiryDate: { $gt: new Date() }
    })
      .sort('-postedDate')
      .limit(4)
      .populate('companyId', 'name logo')
      .populate('categoryId', 'name');

    res.json(jobs);
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching government jobs',
      error: error.message
    });
  }
});

module.exports = router;
