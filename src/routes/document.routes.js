const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth.middleware');
const Document = require('../models/document.model');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdsParser = require('../services/pds-parser.service');
const PdsExtractedData = require('../models/pdsExtractedData.model');

/**
 * PDS Data Processing Pipeline:
 * 1. PDF → Images (using pdf-poppler)
 * 2. Images → OpenAI Vision API → Raw JSON
 * 3. Clean malformed responses (cleanOpenAIResponse)
 * 4. Normalize structure (normalizePdsStructure)
 * 5. Save to Document.parsedData (original cleaned data)
 * 6. Save to PdsExtractedData.data (normalized structure)
 *
 * Files saved for debugging:
 * - extracted.json: Raw OpenAI responses
 * - parsed_pages.json: Parsed JSON from each page
 * - merged_pds.json: Combined data from all pages
 * - cleaned_data.json: Data after cleaning malformed responses
 * - normalized_data.json: Final uniform structure for database
 */

// Helper function to clean malformed OpenAI responses
const cleanOpenAIResponse = data => {
  if (!data || typeof data !== 'object') return data;

  const cleaned = {};

  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      // Clean array values
      cleaned[key] = value.map(item => {
        if (typeof item === 'string' && item.includes('\\n')) {
          // This is a malformed string, try to extract the actual data
          try {
            // Remove escape characters and try to parse
            const cleanedStr = item
              .replace(/\\n/g, '\n')
              .replace(/\\"/g, '"')
              .replace(/\\'/g, "'")
              .replace(/\\t/g, '\t');

            // Try to extract content between square brackets or braces
            const arrayMatch = cleanedStr.match(/\[([\s\S]*)\]/);
            if (arrayMatch) {
              const content = arrayMatch[1];
              // Extract individual items
              const items = content
                .split(',')
                .map(item => item.trim().replace(/^['"]|['"]$/g, ''))
                .filter(item => item && item !== 'null');
              return items;
            }

            // If no array found, try to extract object properties
            const objMatch = cleanedStr.match(/\{([\s\S]*)\}/);
            if (objMatch) {
              const content = objMatch[1];
              const properties = {};
              const propRegex = /(\w+):\s*\[([^\]]*)\]/g;
              let match;
              while ((match = propRegex.exec(content)) !== null) {
                const key = match[1];
                const values = match[2]
                  .split(',')
                  .map(v => v.trim().replace(/^['"]|['"]$/g, ''))
                  .filter(v => v && v !== 'null');
                properties[key] = values;
              }
              return properties;
            }

            return item; // Return original if can't parse
          } catch (e) {
            console.log('⚠️ Failed to clean malformed string:', item);
            return item;
          }
        }
        return item;
      });
    } else if (typeof value === 'object' && value !== null) {
      // Recursively clean nested objects
      cleaned[key] = cleanOpenAIResponse(value);
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
};

// Helper function to normalize PDS data structure for consistent database storage
const normalizePdsStructure = data => {
  if (!data || typeof data !== 'object') return data;

  // Define the expected uniform structure
  const normalized = {
    personalInformation: {
      firstName: '',
      lastName: '',
      middleName: '',
      nameExtension: '',
      dateOfBirth: '',
      placeOfBirth: '',
      sex: '',
      civilStatus: '',
      citizenship: {
        type: '',
        dualBy: null,
        country: null
      },
      heightCm: '',
      weightKg: '',
      bloodType: '',
      gsisIdNo: '',
      pagIbigIdNo: '',
      philHealthNo: '',
      sssNo: '',
      tin: '',
      agencyEmployeeNo: '',
      emailAddress: '',
      mobileNo: '',
      telephoneNo: '',
      residentialAddress: {
        houseLotBlockNo: '',
        street: '',
        subdivisionVillage: '',
        barangay: '',
        cityMunicipality: '',
        province: '',
        zipCode: ''
      },
      permanentAddress: {
        houseLotBlockNo: '',
        street: '',
        subdivisionVillage: '',
        barangay: '',
        cityMunicipality: '',
        province: '',
        zipCode: ''
      }
    },
    familyBackground: {
      spouse: {
        firstName: '',
        lastName: '',
        middleName: '',
        nameExtension: '',
        occupation: '',
        businessName: '',
        businessAddress: '',
        telephoneNo: ''
      },
      father: {
        firstName: '',
        lastName: '',
        middleName: '',
        nameExtension: ''
      },
      motherMaidenName: {
        firstName: '',
        lastName: '',
        middleName: '',
        nameExtension: ''
      }
    },
    educationalBackground: [],
    civilServiceEligibility: [],
    workExperience: [],
    voluntaryWork: [],
    trainings: [],
    skills: [],
    recognitions: [],
    memberships: [],
    references: []
  };

  // Map the cleaned data to the normalized structure
  if (data.personalInformation) {
    Object.assign(normalized.personalInformation, data.personalInformation);
  }
  if (data.familyBackground) {
    Object.assign(normalized.familyBackground, data.familyBackground);
  }
  if (Array.isArray(data.educationalBackground)) {
    normalized.educationalBackground = data.educationalBackground;
  }
  if (Array.isArray(data.civilServiceEligibility)) {
    normalized.civilServiceEligibility = data.civilServiceEligibility;
  }
  if (Array.isArray(data.workExperience)) {
    normalized.workExperience = data.workExperience;
  }
  if (Array.isArray(data.voluntaryWork)) {
    normalized.voluntaryWork = data.voluntaryWork;
  }
  if (Array.isArray(data.trainings)) {
    normalized.trainings = data.trainings;
  }
  if (Array.isArray(data.skills)) {
    normalized.skills = data.skills;
  }
  if (Array.isArray(data.recognitions)) {
    normalized.recognitions = data.recognitions;
  }
  if (Array.isArray(data.memberships)) {
    normalized.memberships = data.memberships;
  }
  if (Array.isArray(data.references)) {
    normalized.references = data.references;
  }

  // Handle legacy field names for backward compatibility
  if (data.personalInfo && !data.personalInformation) {
    Object.assign(normalized.personalInformation, data.personalInfo);
  }
  if (data.family && !data.familyBackground) {
    Object.assign(normalized.familyBackground, data.family);
  }
  if (data.education && !data.educationalBackground) {
    normalized.educationalBackground = data.education;
  }
  if (data.civilService && !data.civilServiceEligibility) {
    normalized.civilServiceEligibility = data.civilService;
  }
  if (data.workExperience && !data.workExperience) {
    normalized.workExperience = data.workExperience;
  }
  if (data.voluntaryWork && !data.voluntaryWork) {
    normalized.voluntaryWork = data.voluntaryWork;
  }
  if (data.training && !data.trainings) {
    normalized.trainings = data.training;
  }

  return normalized;
};

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

    // --- PDS PDF to image + OpenAI extraction ---
    if (doc.type === 'pds' && req.file.mimetype === 'application/pdf') {
      const pdf = require('pdf-poppler');
      const { OpenAI } = require('openai');
      const outputDir = path.join('uploads', 'pds', doc._id.toString());
      if (!fs.existsSync(outputDir))
        fs.mkdirSync(outputDir, { recursive: true });

      // Convert PDF to images
      await pdf.convert(req.file.path, {
        format: 'jpeg',
        out_dir: outputDir,
        out_prefix: 'page',
        page: null // all pages
      });

      // Get all image files
      const imageFiles = fs
        .readdirSync(outputDir)
        .filter(f => f.endsWith('.jpg'))
        .map(f => path.join(outputDir, f));

      // OpenAI Vision API setup
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // Process all images in parallel
      const parsedPages = await Promise.all(
        imageFiles.map(async imgPath => {
          const imageData = fs.readFileSync(imgPath, { encoding: 'base64' });
          const response = await openai.chat.completions.create({
            model: 'gpt-5',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `
              Extract all the information from the uploaded Personal Data Sheet (PDS) 
              and organize it into a well-structured JSON format. Ensure that:

              1. The JSON keys follow a consistent naming convention using camelCase.  
              2. Group related fields under logical sections (e.g., personalInformation, 
                 familyBackground, educationalBackground, civilServiceEligibility, 
                 workExperience, voluntaryWork, trainings, skills, references).  
              3. Dates should follow the YYYY-MM-DD format.  
              4. Numbers should be integers/floats, not strings.  
              5. Empty/missing values should be null.  
              6. Use arrays for multiple entries (e.g., workExperience, trainings, references).  
              7. Preserve all details as written in the PDS without summarizing.  

              Return ONLY the JSON object as output.
              `
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:image/jpeg;base64,${imageData}`,
                      detail: 'high'
                    }
                  }
                ]
              }
            ]
          });

          // Parse response as JSON (in case the API returns extra text)
          try {
            return JSON.parse(response.choices[0].message.content);
          } catch (err) {
            console.error(
              '⚠️ Invalid JSON returned:',
              response.choices[0].message.content
            );
            return null;
          }
        })
      );

      // Merge/extract fields from all pages
      const merged = {};

      parsedPages.forEach(page => {
        if (!page) return; // skip null/invalid pages

        for (const [key, value] of Object.entries(page)) {
          if (Array.isArray(merged[key]) && Array.isArray(value)) {
            merged[key] = [...merged[key], ...value];
          } else if (merged[key] && value) {
            merged[key] = value;
          } else if (!merged[key]) {
            merged[key] = value;
          }
        }
      });

      // Save parsedPages to JSON (all pages separately)
      const parsedPagesPath = path.join(outputDir, 'parsed_pages.json');
      fs.writeFileSync(
        parsedPagesPath,
        JSON.stringify(parsedPages, null, 2),
        'utf-8'
      );

      // Save merged PDS to JSON (final merged result)
      const mergedPath = path.join(outputDir, 'merged_pds.json');
      fs.writeFileSync(mergedPath, JSON.stringify(merged, null, 2), 'utf-8');

      console.log(`✅ Saved parsed pages: ${parsedPagesPath}`);
      console.log(`✅ Saved merged PDS: ${mergedPath}`);

      console.log({ merged });

      // Clean the merged data to fix malformed OpenAI responses
      console.log('✅ Cleaning merged data to fix malformed responses...');
      const cleanedMerged = cleanOpenAIResponse(merged);

      // Normalize the structure for consistent database storage
      console.log('✅ Normalizing PDS data structure...');
      const normalizedData = normalizePdsStructure(cleanedMerged);

      // Log what we're about to save
      console.log('📝 Original merged data structure:', Object.keys(merged));
      console.log('🧹 Cleaned data structure:', Object.keys(cleanedMerged));
      console.log('🔧 Normalized data structure:', Object.keys(normalizedData));

      // Save the cleaned data to a file for verification
      const cleanedDataPath = path.join(outputDir, 'cleaned_data.json');
      fs.writeFileSync(
        cleanedDataPath,
        JSON.stringify(cleanedMerged, null, 2),
        'utf-8'
      );
      console.log(`✅ Saved cleaned data: ${cleanedDataPath}`);

      // Save the normalized data to a file for verification
      const normalizedDataPath = path.join(outputDir, 'normalized_data.json');
      fs.writeFileSync(
        normalizedDataPath,
        JSON.stringify(normalizedData, null, 2),
        'utf-8'
      );
      console.log(`✅ Saved normalized data: ${normalizedDataPath}`);

      // Save the cleaned merged data to the document (keep original for backward compatibility)
      doc.parsedData = cleanedMerged;
      await doc.save();

      // Remove any existing PDS data for this document to prevent duplicates
      await PdsExtractedData.deleteMany({
        userId: doc.userId,
        documentId: doc._id
      });

      // Save the normalized data to PdsExtractedData collection for consistent structure
      await PdsExtractedData.create({
        userId: doc.userId,
        documentId: doc._id,
        data: normalizedData
      });

      console.log(
        '✅ Saved cleaned merged data to database (removed old entries)'
      );

      // Only delete image files, keep JSON files for debugging
      imageFiles.forEach(imgPath => {
        try {
          fs.unlinkSync(imgPath);
        } catch (e) {
          console.error('Failed to delete image:', imgPath, e);
        }
      });

      console.log(
        '✅ Kept JSON files for debugging: extracted.json, parsed_pages.json, merged_pds.json, cleaned_data.json, normalized_data.json'
      );
    }

    res.status(201).json(doc);
  } catch (error) {
    console.log({ error });
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

// Get PDS extracted data for a specific document
router.get('/pds-data/:documentId', auth, async (req, res) => {
  try {
    const { documentId } = req.params;

    console.log(`🔍 Fetching PDS data for document: ${documentId}`);

    // First verify the document exists and user has access
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (document.userId.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: 'Not authorized to access this document' });
    }

    // Get the extracted PDS data - be more specific
    const pdsData = await PdsExtractedData.findOne({
      userId: req.user._id,
      documentId: documentId
    }).sort({ createdAt: -1 }); // Get the most recent one if multiple exist

    if (!pdsData) {
      // Let's check what's in the collection for debugging
      const allPdsData = await PdsExtractedData.find({
        userId: req.user._id
      });

      console.log(`⚠️ No PDS data found for document ${documentId}`);
      console.log(`📊 Total PDS entries for user: ${allPdsData.length}`);
      console.log(
        `📋 Available document IDs:`,
        allPdsData.map(p => p.documentId.toString())
      );

      return res.status(404).json({
        message: 'PDS extracted data not found',
        debug: {
          totalEntries: allPdsData.length,
          availableDocumentIds: allPdsData.map(p => p.documentId.toString())
        }
      });
    }

    console.log(`✅ Found PDS data for document ${documentId}`);
    console.log(`📅 PDS data created at: ${pdsData.createdAt}`);
    console.log(`🔑 Data keys:`, Object.keys(pdsData.data || {}));

    res.json(pdsData.data);
  } catch (error) {
    console.error('❌ Error fetching PDS data:', error);
    res
      .status(500)
      .json({ message: 'Error fetching PDS data', error: error.message });
  }
});

// Debug endpoint to see all PDS extracted data for a user
router.get('/pds-data-debug', auth, async (req, res) => {
  try {
    const allPdsData = await PdsExtractedData.find({
      userId: req.user._id
    }).populate('documentId', 'title type createdAt');

    console.log(
      `🔍 Debug: Found ${allPdsData.length} PDS entries for user ${req.user._id}`
    );

    res.json({
      totalEntries: allPdsData.length,
      entries: allPdsData.map(entry => ({
        id: entry._id,
        documentId: entry.documentId,
        documentTitle: entry.documentId?.title || 'Unknown',
        documentType: entry.documentId?.type || 'Unknown',
        documentCreatedAt: entry.documentId?.createdAt,
        pdsDataCreatedAt: entry.createdAt,
        dataKeys: Object.keys(entry.data || {}),
        hasPersonalInfo: !!entry.data?.personalInformation
      }))
    });
  } catch (error) {
    console.error('❌ Error in PDS debug endpoint:', error);
    res.status(500).json({
      message: 'Error fetching PDS debug info',
      error: error.message
    });
  }
});

// Cleanup endpoint to remove duplicate/old PDS data entries
router.delete('/pds-data-cleanup', auth, async (req, res) => {
  try {
    const allPdsData = await PdsExtractedData.find({
      userId: req.user._id
    });

    if (allPdsData.length <= 1) {
      return res.json({
        message: 'No cleanup needed',
        totalEntries: allPdsData.length
      });
    }

    // Option 1: Keep only the most recent entry for each document (current behavior)
    // Option 2: Keep only the single most recent entry across all documents

    const { keepOnePerDocument = true } = req.query; // Default to current behavior

    let entriesToKeep, entriesToRemove;

    if (keepOnePerDocument === 'false') {
      // Keep only the single most recent entry across all documents
      const sortedByDate = allPdsData.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      entriesToKeep = [sortedByDate[0]]; // Keep only the most recent one
      entriesToRemove = allPdsData.slice(1); // Remove all others
    } else {
      // Keep only the most recent entry for each document (current behavior)
      const documentGroups = {};

      console.log({ allPdsData });
      allPdsData.forEach(entry => {
        const docId = entry.documentId.toString();
        if (
          !documentGroups[docId] ||
          new Date(entry.createdAt) > new Date(documentGroups[docId].createdAt)
        ) {
          documentGroups[docId] = entry;
        }
      });

      entriesToKeep = Object.values(documentGroups);

      console.log({ entriesToKeep });
      entriesToRemove = allPdsData.filter(
        entry =>
          !entriesToKeep.find(
            keep => keep._id.toString() === entry._id.toString()
          )
      );
    }

    console.log({ entriesToRemove });
    if (entriesToRemove.length > 0) {
      await PdsExtractedData.deleteMany({
        _id: { $in: entriesToRemove.map(e => e._id) }
      });
    }

    console.log(
      `🧹 Cleaned up ${entriesToRemove.length} duplicate PDS entries for user ${req.user._id}`
    );

    res.json({
      message: 'Cleanup completed',
      removedEntries: entriesToRemove.length,
      remainingEntries: entriesToKeep.length,
      remainingDocuments: entriesToKeep.map(e => e.documentId.toString()),
      cleanupMode:
        keepOnePerDocument === 'false'
          ? 'single_most_recent'
          : 'one_per_document'
    });
  } catch (error) {
    console.error('❌ Error in PDS cleanup endpoint:', error);
    res.status(500).json({
      message: 'Error during cleanup',
      error: error.message
    });
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

    await Document.findByIdAndDelete(req.params.id);
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
