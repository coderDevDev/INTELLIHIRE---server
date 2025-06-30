const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth.middleware');
const Application = require('../models/application.model');
const Job = require('../models/job.model');
const Document = require('../models/document.model');

// Middleware for validation
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Get all applications (admin/employer)
router.get('/', [auth, authorize('admin', 'employer')], async (req, res) => {
  try {
    const {
      jobId,
      applicantId,
      status,
      page = 1,
      limit = 10,
      sort = '-createdAt'
    } = req.query;

    const query = {};

    if (jobId) query.jobId = jobId;
    if (applicantId) query.applicantId = applicantId;
    if (status) query.status = status;

    // If employer, only show applications for their company's jobs
    if (req.user.role === 'employer') {
      const jobs = await Job.find({ companyId: req.user.companyId }).select(
        '_id'
      );
      query.jobId = { $in: jobs.map(job => job._id) };
    }

    const applications = await Application.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('jobId', 'title companyId')
      .populate('applicantId', 'firstName lastName email')
      .populate('resumeId', 'title fileUrl')
      .populate('pdsId', 'title fileUrl');

    const total = await Application.countDocuments(query);

    res.json({
      applications,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error fetching applications', error: error.message });
  }
});

// Get application by ID (admin/employer/applicant)
router.get('/:id', auth, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate('jobId', 'title companyId')
      .populate('applicantId', 'firstName lastName email')
      .populate('resumeId', 'title fileUrl')
      .populate('pdsId', 'title fileUrl')
      .populate('additionalDocuments', 'title fileUrl');

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check permissions
    if (
      req.user.role === 'applicant' &&
      application.applicantId._id.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: 'Not authorized to view this application' });
    }

    if (req.user.role === 'employer') {
      const job = await Job.findById(application.jobId._id);
      if (job.companyId.toString() !== req.user.companyId.toString()) {
        return res
          .status(403)
          .json({ message: 'Not authorized to view this application' });
      }
    }

    res.json(application);
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error fetching application', error: error.message });
  }
});

// Create new application (applicant only)
router.post(
  '/',
  [
    auth,
    authorize('applicant'),
    body('jobId').notEmpty(),
    body('resumeId').notEmpty(),
    validate
  ],
  async (req, res) => {
    try {
      // Check if job exists and is active
      const job = await Job.findOne({
        _id: req.body.jobId,
        status: 'active',
        expiryDate: { $gt: new Date() }
      });

      if (!job) {
        return res.status(400).json({ message: 'Job not found or not active' });
      }

      // Check if user has already applied
      const existingApplication = await Application.findOne({
        jobId: req.body.jobId,
        applicantId: req.user._id
      });

      if (existingApplication) {
        return res
          .status(400)
          .json({ message: 'You have already applied for this job' });
      }

      // Verify documents belong to user
      const documents = await Document.find({
        _id: {
          $in: [
            req.body.resumeId,
            req.body.pdsId,
            ...(req.body.additionalDocuments || [])
          ]
        },
        userId: req.user._id
      });

      if (
        documents.length !==
        [
          req.body.resumeId,
          req.body.pdsId,
          ...(req.body.additionalDocuments || [])
        ].length
      ) {
        return res.status(400).json({ message: 'Invalid document IDs' });
      }

      const application = new Application({
        ...req.body,
        applicantId: req.user._id,
        status: 'applied'
      });

      await application.save();

      // Update job application count
      await Job.findByIdAndUpdate(req.body.jobId, {
        $inc: { applicationCount: 1 }
      });

      res.status(201).json(application);
    } catch (error) {
      res
        .status(500)
        .json({ message: 'Error creating application', error: error.message });
    }
  }
);

// Update application status (admin/employer only)
router.patch(
  '/:id/status',
  [
    auth,
    authorize('admin', 'employer'),
    body('status').isIn([
      'screening',
      'interview',
      'offered',
      'hired',
      'rejected',
      'withdrawn'
    ]),
    body('notes').optional(),
    validate
  ],
  async (req, res) => {
    try {
      const application = await Application.findById(req.params.id);

      if (!application) {
        return res.status(404).json({ message: 'Application not found' });
      }

      // Check if employer has permission
      if (req.user.role === 'employer') {
        const job = await Job.findById(application.jobId);
        if (job.companyId.toString() !== req.user.companyId.toString()) {
          return res
            .status(403)
            .json({ message: 'Not authorized to update this application' });
        }
      }

      application.status = req.body.status;
      if (req.body.notes) application.notes = req.body.notes;

      await application.save();

      res.json(application);
    } catch (error) {
      res.status(500).json({
        message: 'Error updating application status',
        error: error.message
      });
    }
  }
);

// Schedule interview (admin/employer only)
router.post(
  '/:id/interview',
  [
    auth,
    authorize('admin', 'employer'),
    body('interviewDate').isISO8601(),
    body('interviewLocation').notEmpty(),
    body('interviewType').isIn(['in-person', 'phone', 'video']),
    validate
  ],
  async (req, res) => {
    try {
      const application = await Application.findById(req.params.id);

      if (!application) {
        return res.status(404).json({ message: 'Application not found' });
      }

      // Check if employer has permission
      if (req.user.role === 'employer') {
        const job = await Job.findById(application.jobId);
        if (job.companyId.toString() !== req.user.companyId.toString()) {
          return res
            .status(403)
            .json({ message: 'Not authorized to schedule interview' });
        }
      }

      application.interviewDate = req.body.interviewDate;
      application.interviewLocation = req.body.interviewLocation;
      application.interviewType = req.body.interviewType;
      application.status = 'interview';

      await application.save();

      res.json(application);
    } catch (error) {
      res
        .status(500)
        .json({ message: 'Error scheduling interview', error: error.message });
    }
  }
);

// Withdraw application (applicant only)
router.post(
  '/:id/withdraw',
  [auth, authorize('applicant')],
  async (req, res) => {
    try {
      const application = await Application.findById(req.params.id);

      if (!application) {
        return res.status(404).json({ message: 'Application not found' });
      }

      if (application.applicantId.toString() !== req.user._id.toString()) {
        return res
          .status(403)
          .json({ message: 'Not authorized to withdraw this application' });
      }

      if (application.status === 'withdrawn') {
        return res
          .status(400)
          .json({ message: 'Application already withdrawn' });
      }

      application.status = 'withdrawn';
      await application.save();

      res.json(application);
    } catch (error) {
      res.status(500).json({
        message: 'Error withdrawing application',
        error: error.message
      });
    }
  }
);

module.exports = router;
