const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth.middleware');
const Document = require('../models/document.model');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdsParser = require('../services/pds-parser.service');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/documents/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'doc-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Middleware for validation
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Upload document
router.post('/', [auth, upload.single('file')], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    // Save document info to DB, including type
    const doc = new Document({
      userId: req.user._id,
      title: req.file.originalname,
      fileUrl: req.file.path,
      type: req.body.type
    });
    await doc.save();
    res.status(201).json(doc);
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error uploading document', error: error.message });
  }
});

// Get user's documents
router.get('/my-documents', auth, async (req, res) => {
  try {
    const { type } = req.query;
    const query = { userId: req.user._id };

    if (type) {
      query.type = type;
    }

    const documents = await Document.find(query).sort('-createdAt');

    res.json(documents);
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error fetching documents', error: error.message });
  }
});

// Get document by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Check if user has permission to access this document
    if (
      document.userId.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin' &&
      req.user.role !== 'employer'
    ) {
      return res
        .status(403)
        .json({ message: 'Not authorized to access this document' });
    }

    res.json(document);
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error fetching document', error: error.message });
  }
});

// Update document
router.put(
  '/:id',
  [
    auth,
    body('title').optional(),
    body('isDefault').optional().isBoolean(),
    validate
  ],
  async (req, res) => {
    try {
      const document = await Document.findById(req.params.id);

      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }

      if (document.userId.toString() !== req.user._id.toString()) {
        return res
          .status(403)
          .json({ message: 'Not authorized to update this document' });
      }

      if (req.body.title) document.title = req.body.title;
      if (req.body.isDefault !== undefined) {
        document.isDefault = req.body.isDefault;

        // If setting as default, unset other defaults of the same type
        if (document.isDefault) {
          await Document.updateMany(
            {
              userId: req.user._id,
              type: document.type,
              isDefault: true,
              _id: { $ne: document._id }
            },
            { isDefault: false }
          );
        }
      }

      await document.save();
      res.json(document);
    } catch (error) {
      res
        .status(500)
        .json({ message: 'Error updating document', error: error.message });
    }
  }
);

// Delete document
router.delete('/:id', auth, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (document.userId.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: 'Not authorized to delete this document' });
    }

    // Delete file from storage
    if (fs.existsSync(document.fileUrl)) {
      fs.unlinkSync(document.fileUrl);
    }

    await document.remove();
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error deleting document', error: error.message });
  }
});

// Parse PDS document
router.post('/parse-pds/:id', [auth, authorize('admin')], async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (document.type !== 'pds') {
      return res.status(400).json({ message: 'Document is not a PDS' });
    }

    const parsedData = await pdsParser.parsePDS(document.fileUrl);
    document.parsedData = parsedData;
    await document.save();

    res.json(document);
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error parsing PDS', error: error.message });
  }
});

module.exports = router;
