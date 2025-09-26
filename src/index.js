// mongo db connection
// username: mdexter958
// password: ZG6jgxXwd6xPedTn

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const schedulerService = require('./services/scheduler.service');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const jobRoutes = require('./routes/job.routes');
const companyRoutes = require('./routes/company.routes');
const applicationRoutes = require('./routes/application.routes');
const documentRoutes = require('./routes/document.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const jobMatchingRoutes = require('./routes/job-matching.routes');
const jobCategoryRoutes = require('./routes/job-category.routes');
const careerPathRoutes = require('./routes/career-path.routes');

const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync(
  'C:\\Users\\ACER\\Desktop\\2025 Capstone Project\\INTELLIHIRE\\PDS.pdf'
);
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let prompt2 = rawText => {
  return `Convert the following Personal Data Sheet (PDS) raw text into a structured JSON format. Extract all available information and organize it according to the standard PDS sections. Use null for empty or missing fields, and maintain data types appropriately (strings for text, numbers for numeric values, arrays for lists, objects for nested data).
Structure the JSON with the following main sections:
- personal_information
- family_background  
- educational_background
- civil_service_eligibility
- work_experience
- voluntary_work
- learning_and_development
- other_information
- questionnaire_responses
- references
- authentication

For each section, create appropriate nested objects and arrays. For dates, use the format "mm/dd/yyyy" as provided in the source. For salary amounts, extract numeric values. For boolean fields in questionnaire responses, use true/false/null.

Example structure:
{
  "personal_information": {
    "cs_id_no": null,
    "surname": "string",
    "first_name": "string",
    "middle_name": "string",
    "name_extension": null,
    "date_of_birth": "mm/dd/yyyy",
    "place_of_birth": "string",
    "sex": "Male/Female",
    "civil_status": "string",
    "height": "string",
    "weight": "string",
    "blood_type": "string",
    "gsis_id_no": "string",
    "pag_ibig_id_no": "string",
    "philhealth_no": "string",
    "sss_no": "string",
    "tin_no": "string",
    "agency_employee_no": "string",
    "citizenship": "string",
    "dual_citizenship": null,
    "residential_address": {
      "house_block_lot": "string",
      "street": "string",
      "subdivision_village": "string",
      "barangay": "string",
      "city_municipality": "string",
      "province": "string",
      "zip_code": "string"
    },
    "permanent_address": {
      // same structure as residential_address
    },
    "telephone_no": "string",
    "mobile_no": "string",
    "email_address": "string"
  },
  "family_background": {
    "spouse": {
      "surname": "string",
      "first_name": "string",
      "middle_name": "string",
      "occupation": "string",
      "employer_business_name": "string",
      "business_address": "string",
      "telephone_no": "string"
    },
    "children": [
      {
        "name": "string",
        "date_of_birth": "mm/dd/yyyy"
      }
    ],
    "father": {
      "surname": "string",
      "first_name": "string",
      "middle_name": "string"
    },
    "mother": {
      "maiden_name": "string",
      "surname": "string",
      "first_name": "string",
      "middle_name": "string"
    }
  },
  "educational_background": [
    {
      "level": "ELEMENTARY/SECONDARY/VOCATIONAL/COLLEGE/GRADUATE STUDIES",
      "school_name": "string",
      "basic_education_degree_course": "string",
      "period_attendance": {
        "from": "mm/dd/yyyy",
        "to": "mm/dd/yyyy"
      },
      "highest_level_units_earned": "string",
      "year_graduated": "yyyy",
      "scholarship_academic_honors": "string"
    }
  ],
  "civil_service_eligibility": [
    {
      "career_service": "string",
      "rating": "string",
      "date_of_examination": "mm/dd/yyyy",
      "place_of_examination": "string",
      "license_number": "string",
      "date_of_validity": "mm/dd/yyyy"
    }
  ],
  "work_experience": [
    {
      "position_title": "string",
      "department_agency_office_company": "string",
      "inclusive_dates": {
        "from": "mm/dd/yyyy",
        "to": "mm/dd/yyyy"
      },
      "monthly_salary": number,
      "salary_job_pay_grade": "string",
      "status_of_appointment": "string",
      "govt_service": "Y/N"
    }
  ],
  "voluntary_work": [
    {
      "name_address_organization": "string",
      "position_nature_of_work": "string",
      "inclusive_dates": {
        "from": "mm/dd/yyyy",
        "to": "mm/dd/yyyy"
      },
      "number_of_hours": "string"
    }
  ],
  "learning_and_development": [
    {
      "title": "string",
      "type_of_ld": "string",
      "conducted_sponsored_by": "string",
      "inclusive_dates": {
        "from": "mm/dd/yyyy",
        "to": "mm/dd/yyyy"
      },
      "number_of_hours": "string"
    }
  ],
  "other_information": {
    "special_skills_hobbies": "string",
    "non_academic_distinctions": "string",
    "membership_in_organizations": "string"
  },
  "questionnaire_responses": {
    "person_with_disability": null,
    "solo_parent": null,
    "member_of_indigenous_group": null,
    "immigrant_permanent_resident": null,
    "related_by_consanguinity_affinity": null,
    "found_guilty_administrative_offense": null,
    "criminally_charged": null,
    "convicted_of_crime": null,
    "candidate_in_election": null,
    "resigned_for_election_campaign": null,
    "separated_from_service": null
  },
  "references": [
    {
      "name": "string",
      "address": "string",
      "telephone_no": "string"
    }
  ],
  "authentication": {
    "date_accomplished": "mm/dd/yyyy",
    "government_issued_id": "string",
    "id_number": "string",
    "date_of_issuance": "mm/dd/yyyy"
  }
}
}

Now convert the following PDS raw text:

${rawText}

`;
};
async function parsePDS(rawText) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const result = await model.generateContent(prompt2(rawText));
  const text = result.response.text();
  // Gemini doesn’t have strict JSON mode, so force-parse
  try {
    return text;
  } catch (e) {
    // console.error('⚠️ Model did not return valid JSON. Raw output:', text);
    return null;
  }
}

// Example usage
(async () => {
  pdf(dataBuffer).then(async data => {
    const rawData = data.text;

    const parsed = await parsePDS(rawData);

    // console.log('Dex');
    // console.log(JSON.stringify(JSON.parse(parsed), null, 2));
  });
})();

const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// MongoDB Connection Configuration
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database Name: ${conn.connection.name}`);

    // Verify connection by listing collections
    const collections = await conn.connection.db.listCollections().toArray();
    console.log(
      'Available Collections:',
      collections.map(c => c.name)
    );

    // Set up connection event handlers
    mongoose.connection.on('error', err => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });

    // Handle application termination
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed through app termination');
        process.exit(0);
      } catch (err) {
        console.error('Error during MongoDB disconnection:', err);
        process.exit(1);
      }
    });

    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    // Exit process with failure
    process.exit(1);
  }
};

// Initialize MongoDB connection
connectDB()
  .then(() => {
    // Initialize scheduled tasks after DB connection
    schedulerService.initialize();
  })
  .catch(err => {
    console.error('Failed to initialize application:', err);
    process.exit(1);
  });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/matching', jobMatchingRoutes);
app.use('/api/categories', jobCategoryRoutes);
app.use('/api/career-paths', careerPathRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', err => {
  console.error('Unhandled Promise Rejection:', err);
  // Close server & exit process
  process.exit(1);
});
