const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth.middleware');
const JobCategory = require('../models/jobCategory.model');

// Middleware for validation
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Get all job categories (public)
router.get('/', async (req, res) => {
  try {
    const { isActive, parentCategory } = req.query;

    const query = {};
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (parentCategory) query.parentCategory = parentCategory;

    const categories = await JobCategory.find(query)
      .sort('name')
      .populate('parentCategory', 'name');

    res.json(categories);
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error fetching job categories', error: error.message });
  }
});

// Get job category by ID (public)
router.get('/:id', async (req, res) => {
  try {
    const category = await JobCategory.findById(req.params.id).populate(
      'parentCategory',
      'name'
    );

    if (!category) {
      return res.status(404).json({ message: 'Job category not found' });
    }

    res.json(category);
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error fetching job category', error: error.message });
  }
});

// Create new job category (admin only)
router.post(
  '/',
  [auth, authorize('admin'), body('name').notEmpty().trim(), validate],
  async (req, res) => {
    try {
      const category = new JobCategory(req.body);
      await category.save();
      res.status(201).json(category);
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(400)
          .json({ message: 'Category name already exists' });
      }
      res
        .status(500)
        .json({ message: 'Error creating job category', error: error.message });
    }
  }
);

// Update job category (admin only)
router.put('/:id', [auth, authorize('admin'), validate], async (req, res) => {
  try {
    const category = await JobCategory.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: 'Job category not found' });
    }

    Object.assign(category, req.body);
    await category.save();

    res.json(category);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Category name already exists' });
    }
    res
      .status(500)
      .json({ message: 'Error updating job category', error: error.message });
  }
});

// Delete job category (admin only)
router.delete('/:id', [auth, authorize('admin')], async (req, res) => {
  try {
    const category = await JobCategory.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: 'Job category not found' });
    }

    // Check if category has child categories
    const hasChildren = await JobCategory.exists({
      parentCategory: req.params.id
    });
    if (hasChildren) {
      return res.status(400).json({
        message: 'Cannot delete category with subcategories'
      });
    }

    await category.remove();
    res.json({ message: 'Job category deleted successfully' });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error deleting job category', error: error.message });
  }
});

module.exports = router;
