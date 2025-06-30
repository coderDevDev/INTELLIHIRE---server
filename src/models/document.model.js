const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      enum: ['pds', 'resume', 'cv', 'cover-letter', 'certificate', 'other'],
      required: true
    },
    title: String,
    fileUrl: {
      type: String,
      required: true
    },
    fileSize: Number,
    fileType: String,
    isDefault: {
      type: Boolean,
      default: false
    },
    parsedData: {
      personalInfo: {
        firstName: String,
        lastName: String,
        middleName: String,
        birthDate: Date,
        birthPlace: String,
        gender: String,
        civilStatus: String,
        citizenship: String,
        address: {
          residential: {
            houseNumber: String,
            street: String,
            subdivision: String,
            barangay: String,
            city: String,
            province: String,
            zipCode: String
          },
          permanent: {
            houseNumber: String,
            street: String,
            subdivision: String,
            barangay: String,
            city: String,
            province: String,
            zipCode: String
          }
        },
        contactInfo: {
          telephone: String,
          mobile: String,
          email: String
        }
      },
      education: [
        {
          level: String,
          schoolName: String,
          degree: String,
          from: String,
          to: String,
          units: String,
          yearGraduated: String,
          honors: String
        }
      ],
      civilService: [
        {
          examTitle: String,
          rating: String,
          examDate: Date,
          examPlace: String,
          licenseNumber: String,
          validity: String
        }
      ],
      workExperience: [
        {
          position: String,
          company: String,
          from: Date,
          to: Date,
          salary: Number,
          salaryGrade: String,
          appointmentStatus: String,
          isGovernmentService: Boolean
        }
      ],
      training: [
        {
          title: String,
          from: Date,
          to: Date,
          hours: Number,
          type: String,
          sponsor: String
        }
      ],
      skills: [String]
    }
  },
  {
    timestamps: true
  }
);

// Indexes
documentSchema.index({ userId: 1 });
documentSchema.index({ type: 1 });
documentSchema.index({ userId: 1, type: 1 });

module.exports = mongoose.model('Document', documentSchema);
